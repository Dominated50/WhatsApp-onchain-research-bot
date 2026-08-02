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

    console.log("Wallet balance raw response:", JSON.stringify(data).slice(0, 2000));
    return data;
  } catch (err) {
    console.error("Wallet balance error:", err.response?.data || err.message);
    return null;
  }
}

module.exports = { getWalletHoldings };
