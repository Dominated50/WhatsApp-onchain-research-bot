const axios = require("axios");
const { DEXSCREENER_TO_GOPLUS, isSolanaChain } = require("./chains");

/**
 * Fetches contract-level security data from GoPlus Security (free tier, no key needed
 * for low volume — register at gopluslabs.io for higher rate limits).
 * Docs: https://docs.gopluslabs.io/
 */
async function getSecurityData(contractAddress, dexChainId) {
  try {
    if (isSolanaChain(dexChainId)) {
      const { data } = await axios.get(
        `https://api.gopluslabs.io/api/v1/solana/token_security?contract_addresses=${contractAddress}`,
        { timeout: 8000 }
      );
      const result = data?.result?.[contractAddress];
      if (!result) return null;
      return normalizeSolana(result);
    }

    const goPlusChainId = DEXSCREENER_TO_GOPLUS[dexChainId];
    if (!goPlusChainId) return null; // unsupported/unmapped chain

    const { data } = await axios.get(
      `https://api.gopluslabs.io/api/v1/token_security/${goPlusChainId}?contract_addresses=${contractAddress}`,
      { timeout: 8000 }
    );
    const result = data?.result?.[contractAddress.toLowerCase()];
    if (!result) return null;
    return normalizeEvm(result);
  } catch (err) {
    console.error("GoPlus error:", err.message);
    return null;
  }
}

function normalizeEvm(r) {
  return {
    isHoneypot: r.is_honeypot === "1",
    buyTax: r.buy_tax ? (parseFloat(r.buy_tax) * 100).toFixed(1) : null,
    sellTax: r.sell_tax ? (parseFloat(r.sell_tax) * 100).toFixed(1) : null,
    ownershipRenounced:
      r.owner_address === "0x0000000000000000000000000000000000000000" ||
      r.can_take_back_ownership === "0",
    isOpenSource: r.is_open_source === "1",
    isMintable: r.is_mintable === "1",
    canBlacklist: r.is_blacklisted === "1" || r.transfer_pausable === "1",
    top10HolderPct: r.holders
      ? sumTopHolders(r.holders, 10)
      : null,
    creatorAddress: r.creator_address || null,
        creatorPercent: r.creator_percent ? (parseFloat(r.creator_percent) * 100).toFixed(1) : null,
    lpLockedPct: r.lp_holders
      ? r.lp_holders
          .filter((h) => h.is_locked === 1)
          .reduce((sum, h) => sum + parseFloat(h.percent || 0), 0) * 100
      : null,
    holderCount: r.holder_count ? parseInt(r.holder_count) : null,
  };
}

function normalizeSolana(r) {
  return {
    isHoneypot: null, // GoPlus Solana doesn't expose this directly yet
    buyTax: null,
    sellTax: null,
    ownershipRenounced: r.mintable?.status === "0",
    isOpenSource: null,
    isMintable: r.mintable?.status === "1",
    canBlacklist: r.freezable?.status === "1",
    top10HolderPct: r.holders ? sumTopHolders(r.holders, 10) : null,
    lpLocked: null,
    holderCount: r.holder_count ? parseInt(r.holder_count) : null,
  };
}

function sumTopHolders(holders, n) {
  const top = holders
    .map((h) => parseFloat(h.percent || 0))
    .sort((a, b) => b - a)
    .slice(0, n);
  return (top.reduce((a, b) => a + b, 0) * 100).toFixed(1);
}

module.exports = { getSecurityData };
