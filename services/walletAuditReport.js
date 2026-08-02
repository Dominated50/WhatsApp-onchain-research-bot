function fmtUsd(n) {
  if (n === undefined || n === null) return "N/A";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Number(n).toFixed(2)}`;
}

function buildWalletAuditReport(audit, walletAddress, chainId) {
  if (!audit || (!audit.holdings.length && !audit.dustTokens.length)) {
    return `🔍 No token holdings found for \`${walletAddress}\` on ${chainId}.`;
  }

  const totalValue = audit.holdings.reduce((sum, h) => sum + h.valueUsd, 0);
  const lines = [
    `👜 *Wallet Audit*`,
    `\`${walletAddress}\` on ${chainId}`,
    ``,
    `💰 Total value checked: ${fmtUsd(totalValue)}`,
    `📊 ${audit.holdings.length} holding(s) analyzed`,
    ``,
  ];

  const risky = [];
  const safe = [];

  for (const h of audit.holdings) {
    const flags = [];
    if (h.sec?.isHoneypot) flags.push("🚨 HONEYPOT");
    if (h.sec?.buyTax != null && parseFloat(h.sec.buyTax) > 10) flags.push(`⚠️ High buy tax (${h.sec.buyTax}%)`);
    if (h.sec?.sellTax != null && parseFloat(h.sec.sellTax) > 10) flags.push(`⚠️ High sell tax (${h.sec.sellTax}%)`);
    if (h.sec?.lpLockedPct != null && h.sec.lpLockedPct === 0) flags.push("⚠️ LP not locked");
    if (h.sec === null) flags.push("❓ Could not verify safety");

    const entry = `*${h.symbol}* — ${fmtUsd(h.valueUsd)}\n\`${h.address}\`${flags.length ? "\n" + flags.map((f) => `  ${f}`).join("\n") : "\n  ✅ No red flags found"}`;

    if (flags.some((f) => f.includes("🚨") || f.includes("⚠️"))) risky.push(entry);
    else safe.push(entry);
  }

  if (risky.length) {
    lines.push(`🚨 *Flagged Holdings (${risky.length}):*`, ``, ...risky, ``);
  }
  if (safe.length) {
    lines.push(`✅ *Clean Holdings (${safe.length}):*`, ``, ...safe, ``);
  }

  if (audit.dustTokens.length) {
    lines.push(`🎁 *Unclaimed/Suspicious Airdrops (${audit.dustTokens.length}):*`);
    lines.push(`_These are worth under $1 — often spam. Don't interact with unfamiliar tokens._`);
    audit.dustTokens.slice(0, 15).forEach((d) => {
      lines.push(`  • ${d.name || d.symbol || "Unknown"} (\`${d.address}\`)`);
    });
    if (audit.dustTokens.length > 15) lines.push(`  ...and ${audit.dustTokens.length - 15} more`);
    lines.push(``);
  }

  lines.push(`_Not financial advice. DYOR._`);

  return lines.join("\n");
}

module.exports = { buildWalletAuditReport };
