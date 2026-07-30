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

function buildReport(address, dex, sec, cg, cmc) {
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
    `🔀 Listed on: ${dex.allDexes?.join(", ") || "N/A"}`,
    `🦎 CoinGecko: ${cg === null ? "Unknown (check failed)" : cg.listed ? `Listed ✅${cg.rank ? ` (Rank #${cg.rank})` : ""}` : "Not listed"}`,
    `🟡 CoinMarketCap: ${cmc?.listed === "uncertain" ? `Unclear — check manually: https://coinmarketcap.com/search/?q=${encodeURIComponent(address)}` : cmc?.listed ? "Listed ✅" : cmc ? "Not listed" : "Unknown (check failed)"}`,
    ];

  if (sec) {
    lines.push(``, `*Security Checks:*`);
    lines.push(`🍯 Honeypot: ${sec.isHoneypot === null ? "Unknown" : sec.isHoneypot ? "YES ⚠️" : "No ✅"}`);
    if (sec.buyTax !== null) lines.push(`💸 Buy/Sell Tax: ${sec.buyTax}% / ${sec.sellTax}%`);
    lines.push(`🏗 Ownership: ${sec.ownershipRenounced ? "Renounced ✅" : "Not renounced ⚠️"}`);
    if (sec.isMintable !== null) lines.push(`🖨 Mintable: ${sec.isMintable ? "Yes ⚠️" : "No ✅"}`);
    if (sec.top10HolderPct !== null) lines.push(`👛 Top 10 Holders (excl. LP/burn): ${sec.top10HolderPct}%`);
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
  lines.push(``, `${riskEmoji} *Risk Score: ${risk ?? "N/A"}/10*`);
  lines.push(``, `_Not financial advice. DYOR._`);

  return lines.join("\n");
}

module.exports = { buildReport };

