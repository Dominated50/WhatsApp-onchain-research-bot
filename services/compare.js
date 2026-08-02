function fmtUsd(n) {
  if (n === undefined || n === null) return "N/A";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Number(n).toFixed(2)}`;
}

function buildCompareReport(a, b) {
  const nameA = `${a.dex?.baseToken?.name || "Unknown"} (${a.symbol || "???"})`;
  const nameB = `${b.dex?.baseToken?.name || "Unknown"} (${b.symbol || "???"})`;

  const lines = [
    `⚖️ *Comparing Tokens*`,
    ``,
    `*A:* ${nameA}`,
    `*B:* ${nameB}`,
    ``,
    `💰 *Price*`,
    `A: $${a.dex?.priceUsd || "N/A"}`,
    `B: $${b.dex?.priceUsd || "N/A"}`,
    ``,
    `🏦 *Market Cap*`,
    `A: ${fmtUsd(a.dex?.marketCap)}`,
    `B: ${fmtUsd(b.dex?.marketCap)}`,
    ``,
    `💧 *Liquidity*`,
    `A: ${fmtUsd(a.dex?.liquidityUsd)}`,
    `B: ${fmtUsd(b.dex?.liquidityUsd)}`,
    ``,
    `📈 *24h Change*`,
    `A: ${a.dex?.priceChange24h ?? "N/A"}%`,
    `B: ${b.dex?.priceChange24h ?? "N/A"}%`,
    ``,
    `👥 *Total Holders*`,
    `A: ${a.sec?.holderCount?.toLocaleString() ?? "N/A"}`,
    `B: ${b.sec?.holderCount?.toLocaleString() ?? "N/A"}`,
    ``,
    `🍯 *Honeypot*`,
    `A: ${a.sec?.isHoneypot ? "🚨 YES" : a.sec?.isHoneypot === false ? "✅ No" : "❓ Unknown"}`,
    `B: ${b.sec?.isHoneypot ? "🚨 YES" : b.sec?.isHoneypot === false ? "✅ No" : "❓ Unknown"}`,
    ``,
    `🔒 *LP Locked*`,
    `A: ${a.sec?.lpLockedPct != null ? a.sec.lpLockedPct.toFixed(0) + "%" : "❓ Unknown"}`,
    `B: ${b.sec?.lpLockedPct != null ? b.sec.lpLockedPct.toFixed(0) + "%" : "❓ Unknown"}`,
    ``,
    `🟢 *Risk Score*`,
    `A: ${a.risk ?? "N/A"}/10`,
    `B: ${b.risk ?? "N/A"}/10`,
    ``,
    `_Not financial advice. DYOR._`,
  ];

  return lines.join("\n");
}

module.exports = { buildCompareReport };
