const axios = require("axios");
const { getSecurityData } = require("./goplus");

const CHAIN_TO_COINSTATS = {
  ethereum: "ethereum",
  bsc: "binance_smart",
  polygon: "polygon",
  arbitrum: "arbitrum",
  optimism: "optimism",
  base: "base",
  avalanche: "avalanche",
  fantom: "fantom",
  solana: "solana",
};

async function getWalletHoldings(walletAddress, chainId) {
  const connectionId = CHAIN_TO_COINSTATS[chainId];
  if (!connectionId) return null;

  try {
    const { data } = await axios.get("https://api.coinstats.app/v1/wallet/balance", {
      params: { address: walletAddress, connectionId },
      headers: { "X-API-KEY": process.env.COINSTATS_API_KEY },
      timeout: 15000,
    });

    if (!Array.isArray(data)) return null;
    return data;
  } catch (err) {
    console.error("Wallet balance error:", err.response?.data || err.message);
    return null;
  }
}

async function auditWallet(walletAddress, chainId) {
  const holdings = await getWalletHoldings(walletAddress, chainId);
  if (!holdings || !holdings.length) return null;

  const withValue = holdings
    .map((h) => ({
      symbol: h.symbol,
      name: h.name,
      address: h.contractAddress,
      valueUsd: (h.amount || 0) * (h.price || 0),
    }))
    .filter((h) => h.address && h.valueUsd >= 1) // skip dust under $1
    .sort((a, b) => b.valueUsd - a.valueUsd)
    .slice(0, 10); // cap at top 10 holdings to limit API calls

  if (!withValue.length) return { holdings: [], skipped: holdings.length };

  const checked = [];
  for (const h of withValue) {
    const sec = await getSecurityData(h.address, chainId);
    checked.push({ ...h, sec });
    await new Promise((r) => setTimeout(r, 300));
  }

  return { holdings: checked, skipped: holdings.length - withValue.length };
}

module.exports = { getWalletHoldings, auditWallet };
