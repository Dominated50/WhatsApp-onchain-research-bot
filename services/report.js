function fmtUsd(n) {
  if (n === undefined || n === null) return "N/A";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Number(n).toFixed(2)}`;
}

function ageFromTimestamp(ts) {
  if (!ts) return "Unknown";
  const days = Math.floor((Date.now() - ts) / 86_400_000);
  if (days < 1) return "<1 day";
  if (days === 1) return "1 day";
  if (days < 30) return `${days} days`;
  return `${Math.floor(days / 30)} months`;
}

/**
 * Very simple heuristic scorer — 0 (worst) to 10 (best).
 * Tune weights as you gather more real-world signal.
 */
function scoreRisk(dex, sec) {
  let score = 5;
  if (!dex || !sec) return null;

  if (sec.isHoneypot) score -= 5;
  if (sec.ownershipRenounced) score += 1.5;
  if (sec.isOpenSource) score += 1;
  if (sec.isMintable) score -= 1;
  if (sec.canBlacklist) score -= 1;
  if (sec.lpLockedPct > 0) score += 1.5;

  const sellTax = parseFloat(sec.sellTax || 0);
  if (sellTax > 10) score -= 2;
  else if (sellTax > 5) score -= 1;

  const top10 = parseFloat(sec.top10HolderPct || 0);
  if (top10 > 50) score -= 2;
  else if (top10 > 30) score -= 1;

  if ((dex.liquidityUsd || 0) < 5000) score -= 2;
  else if ((dex.liquidityUsd || 0) > 50000) score += 1;

  return Math.max(0, Math.min(10, Math.round(score * 10) / 10));
}

const { getHoldersUrl } = require("./chains");

function buildReport(address, dex, sec, cg, cmc, athAtl, wallets, washTrading, dumps) {
  if (!dex) {
    return `⚠️ *No trading pair found* for:\n\`${address}\`\n\nThis token may not be listed on any DEX yet, or the address may be invalid.`;
  }

  const risk = scoreRisk(dex, sec);
  const symbol = dex.baseToken?.symbol || "???";
  const riskEmoji = risk === null ? "❓" : risk >= 7 ? "🟢" : risk >= 4 ? "🟡" : "🔴";

  const lines = [
    `🔍 *${dex.baseToken?.name || "Unknown"} ($${symbol})*`,
    `Chain: ${dex.chainId} | Age: ${ageFromTimestamp(dex.pairCreatedAt)}`,
    ``,
    `💰 Price: $${dex.priceUsd || "N/A"} (${dex.priceChange24h > 0 ? "+" : ""}${dex.priceChange24h ?? "N/A"}% 24h)`,
    `💧 Liquidity: ${fmtUsd(dex.liquidityUsd)}`,
    `📊 Volume: ${fmtUsd(dex.volume1h)} (1h) · ${fmtUsd(dex.volume6h)} (6h) · ${fmtUsd(dex.volume24h)} (24h)`,
    `📈 Price Change: ${dex.priceChange1h > 0 ? "+" : ""}${dex.priceChange1h ?? "N/A"}% (1h) · ${dex.priceChange6h > 0 ? "+" : ""}${dex.priceChange6h ?? "N/A"}% (6h) · ${dex.priceChange24h > 0 ? "+" : ""}${dex.priceChange24h ?? "N/A"}% (24h)`,
    `🏦 Market Cap: ${fmtUsd(dex.marketCap)}`,
    `🔢 Circulating Supply: ${cg?.circulatingSupply ? Number(cg.circulatingSupply).toLocaleString() : (dex.marketCap && dex.priceUsd ? Number(dex.marketCap / parseFloat(dex.priceUsd)).toLocaleString() + " (est.)" : "N/A")}`,
`🧮 Total Supply: ${cg?.totalSupply ? Number(cg.totalSupply).toLocaleString() : (dex.fdv && dex.priceUsd ? Number(dex.fdv / parseFloat(dex.priceUsd)).toLocaleString() + " (est.)" : "N/A")}`,
    `🔀 Listed on: ${dex.allDexes?.join(", ") || "N/A"}`,
    `🦎 CoinGecko: ${cg === null ? "Unknown (check failed)" : cg.listed ? `Listed ✅${cg.rank ? ` (Rank #${cg.rank})` : ""}` : "Not listed"}`,
     ...(athAtl?.athPrice ? [`📈 ATH Price: $${athAtl.athPrice}`] : []),
     ...(athAtl?.atlPrice ? [`📉 ATL Price: $${athAtl.atlPrice}`] : []),
     ...(athAtl?.athMarketCap ? [`📈 ATH Market Cap: ${fmtUsd(athAtl.athMarketCap)}`] : []),
     ...(athAtl?.atlMarketCap ? [`📉 ATL Market Cap: ${fmtUsd(athAtl.atlMarketCap)}`] : []),
     ...(!athAtl ? [`📊 ATH/ATL: Not available for this token yet`] : []),
    `🟡 CoinMarketCap: ${cmc?.listed === "uncertain" ? `Unclear — check manually: https://coinmarketcap.com/search/?q=${encodeURIComponent(address)}` : cmc?.listed ? "Listed ✅" : cmc ? "Not listed" : "Unknown (check failed)"}`,
    ];

  if (sec) {
    lines.push(``, `*Security Checks:*`);
    lines.push(`🍯 Honeypot: ${sec.isHoneypot === null ? "Unknown" : sec.isHoneypot ? "YES ⚠️" : "No ✅"}`);
    if (sec.buyTax !== null) lines.push(`💸 Buy/Sell Tax: ${sec.buyTax}% / ${sec.sellTax}%`);
    lines.push(`🏗 Ownership: ${sec.ownershipRenounced ? "Renounced ✅" : "Not renounced ⚠️"}`);
    if (sec.isMintable !== null) lines.push(`🖨 Mintable: ${sec.isMintable ? "Yes ⚠️" : "No ✅"}`);
    if (sec.top10HolderPct !== null) lines.push(`👛 Top 10 Holders (excl. LP/burn): ${sec.top10HolderPct}%`);
    if (sec.holderCount != null) lines.push(`👥 Total Holders: ${sec.holderCount.toLocaleString()}`);
    if (sec.creatorPercent !== null) {
      lines.push(`👤 Creator Holds: ${sec.creatorPercent}%${parseFloat(sec.creatorPercent) > 10 ? " ⚠️" : ""}`);
    }
    lines.push(
      `🔒 LP Locked: ${
        sec.lpLockedPct === null
          ? "Unknown ❓"
          : sec.lpLockedPct > 0
          ? `${sec.lpLockedPct.toFixed(0)}% ✅`
          : "No ⚠️"
      }`
    );
  } else {
    lines.push(``, `⚠️ Security data unavailable for this chain/token.`);
  }

  const holdersUrl = getHoldersUrl(dex.chainId, address);
  if (holdersUrl) lines.push(``, `🔗 View all holders: ${holdersUrl}`);
if (wallets?.unsupported) {
  lines.push(``, `🔍 Sniper/Cluster Check: Ethereum only for now — not yet available for this chain`);
}

if (wallets?.snipers?.length) {
  lines.push(``, `🎯 *Sniper Alert:* ${wallets.snipers.length} top holder(s) bought within 10 min of launch`);
  for (const s of wallets.snipers) {
    lines.push(`   • \`${s.address}\` (${parseFloat(s.percent).toFixed(2)}% held)`);
    lines.push(`     🔗 https://etherscan.io/address/${s.address}`);
  }
}

if (wallets?.clusters?.length) {
  const totalClustered = wallets.clusters.reduce((sum, c) => sum + c.addresses.length, 0);
  lines.push(``, `🕸️ *Wallet Clustering:* ${totalClustered} holder wallets appear linked to ${wallets.clusters.length} funding source(s) — possible same owner`);
  wallets.clusters.forEach((c) => {
    lines.push(`   • Funded by \`${c.funder}\`:`);
    lines.push(`     🔗 https://etherscan.io/address/${c.funder}`);
    c.addresses.forEach(addr => {
      lines.push(`      - \`${addr}\``);
      lines.push(`        🔗 https://etherscan.io/address/${addr}`);
    });
  });
}

if (washTrading?.suspects?.length) {
  lines.push(``, `🔁 *Wash Trading Alert:* ${washTrading.suspects.length} wallet(s) repeatedly buying/selling — possible fake volume`);
  for (const s of washTrading.suspects) {
    lines.push(`   • \`${s.address}\` (${s.buys} buys, ${s.sells} sells)`);
    lines.push(`     🔗 https://etherscan.io/address/${s.address}`);
  }
}
  if (dumps?.dumps?.length) {
  lines.push(``, `📉 *Dump Alert:* ${dumps.dumps.length} large sell(s) detected during price pumps`);
  for (const d of dumps.dumps) {
    lines.push(`   • \`${d.address}\` sold during a +${d.pumpPercent}% pump`);
    lines.push(`     🔗 https://etherscan.io/address/${d.address}`);
  }
  }
  lines.push(``, `${riskEmoji} *Risk Score: ${risk ?? "N/A"}/10*`);
  lines.push(``, `_Not financial advice. DYOR._`);

  return lines.join("\n");
}
function buildSummary(address, dex, sec, athAtl, wallets, washTrading, dumps) {
  if (!dex) {
    return `⚠️ *No trading pair found* for:\n\`${address}\`\n\nThis token may not be listed on any DEX yet.`;
  }

  const risk = scoreRisk(dex, sec);
  const symbol = dex.baseToken?.symbol || "???";
  const riskEmoji = risk === null ? "❓" : risk >= 7 ? "🟢" : risk >= 4 ? "🟡" : "🔴";
  const verdict = risk === null ? "Unknown" : risk >= 7 ? "Looks safe" : risk >= 4 ? "Proceed with caution" : "High risk";

  const honeypotLine = sec?.isHoneypot === null
    ? "❓ Honeypot status unknown"
    : sec?.isHoneypot
      ? "🚨 *HONEYPOT DETECTED*"
      : "✅ Not a honeypot";

  const flagCount = (wallets?.snipers?.length || 0) +
    (wallets?.clusters?.length || 0) +
    (washTrading?.suspects?.length || 0) +
    (dumps?.dumps?.length || 0);

  const lines = [
    `🔍 *${dex.baseToken?.name || "Unknown"} (${symbol})*`,
    `Chain: ${dex.chainId} | Age: ${ageFromTimestamp(dex.pairCreatedAt)}`,
    ``,
    `💰 Price: $${dex.priceUsd || "N/A"} (${dex.priceChange24h > 0 ? "+" : ""}${dex.priceChange24h}% 24h)`,
    `🏦 Market Cap: ${fmtUsd(dex.marketCap)}`,
    `💧 Liquidity: ${fmtUsd(dex.liquidityUsd)}`,
    honeypotLine,
    `${riskEmoji} Risk Score: ${risk ?? "N/A"}/10 — ${verdict}`,
  ];

  if (flagCount > 0) {
    lines.push(``, `🚨 *${flagCount} wallet red flag(s) detected* — see full report`);
  }

  lines.push(``, `_Reply "more" for the full report._`);

  return lines.join("\n");
}

module.exports = { buildReport, buildSummary };

