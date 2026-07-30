const axios = require("axios");

const CMC_API_KEY = process.env.CMC_API_KEY;

// Maps Dexscreener's chainId strings to CMC's platform slug format
const DEXSCREENER_TO_CMC = {
  ethereum: "ethereum",
  bsc: "bnb-smart-chain",
  polygon: "polygon",
  arbitrum: "arbitrum",
  optimism: "optimism",
  base: "base",
  avalanche: "avalanche",
  fantom: "fantom",
  solana: "solana",
};

async function getCmcListing(address, dexChainId) {
  const platform = DEXSCREENER_TO_CMC[dexChainId];
  if (!platform || !CMC_API_KEY) return null;

  try {
    const { data } = await axios.get(
      "https://pro-api.coinmarketcap.com/v2/cryptocurrency/info",
      {
        params: { address: address.toLowerCase(), aux: "urls" },
        headers: { "X-CMC_PRO_API_KEY": CMC_API_KEY },
        timeout: 8000,
      }
    );

    console.log("CMC raw response:", JSON.stringify(data).slice(0, 500));
    const entries = data?.data ? Object.values(data.data) : [];
    const match = entries[0];
    if (!match) return { listed: false };

    return {
      listed: true,
      cmcId: match.id,
      slug: match.slug,
      url: `https://coinmarketcap.com/currencies/${match.slug}/`,
    };
  } catch (err) {
    console.log("CMC error status:", err.response?.status, "data:", JSON.stringify(err.response?.data)?.slice(0, 300));
    if (err.response?.status === 400 || err.response?.status === 404) {
      return { listed: false };
    }
    console.error("CoinMarketCap error:", err.message);
    return null;
  }
}

module.exports = { getCmcListing };
