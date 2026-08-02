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
const allMapped = holdings
    .filter((h) => h.contractAddress)
    .map((h) => ({
      symbol: h.symbol,
      name: h.name,
      address: h.contractAddress,
      valueUsd: (h.amount || 0) * (h.price || 0),
    }));

  const withValue = allMapped
    .filter((h) => h.valueUsd >= 1)
    .sort((a, b) => b.valueUsd - a.valueUsd)
    .slice(0, 10); // cap real holdings checked at top 10 to limit API calls

  const dustTokens = allMapped.filter((h) => h.valueUsd < 1);

  if (!withValue.length) return { holdings: [], dustTokens, skipped: 0 };

  const checked = [];
  for (const h of withValue) {
    const sec = await getSecurityData(h.address, chainId);
    checked.push({ ...h, sec });
    await new Promise((r) => setTimeout(r, 300));
  }

  return { holdings: checked, dustTokens, skipped: 0 };
}

module.exports = { getWalletHoldings, auditWallet };
