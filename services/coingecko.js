const axios = require("axios");

// Maps Dexscreener's chainId strings to CoinGecko's "platform" id format
const DEXSCREENER_TO_COINGECKO = {
  ethereum: "ethereum",
  bsc: "binance-smart-chain",
  polygon: "polygon-pos",
  arbitrum: "arbitrum-one",
  optimism: "optimistic-ethereum",
  base: "base",
  avalanche: "avalanche",
  fantom: "fantom",
  solana: "solana",
};

async function getCoingeckoListing(address, dexChainId) {
  const platform = DEXSCREENER_TO_COINGECKO[dexChainId];
  if (!platform) return null;

  try {
    const { data } = await axios.get(
      `https://api.coingecko.com/api/v3/coins/${platform}/contract/${address.toLowerCase()}`,
      { timeout: 8000 }
    );

    if (!data?.id) return null;

    return {
      listed: true,
      coingeckoId: data.id,
      rank: data.market_cap_rank || null,
      url: `https://www.coingecko.com/en/coins/${data.id}`,
    };
  } catch (err) {
    if (err.response?.status === 404) {
      return { listed: false };
    }
    console.error("CoinGecko error:", err.message);
    return null;
  }
}

module.exports = { getCoingeckoListing };
