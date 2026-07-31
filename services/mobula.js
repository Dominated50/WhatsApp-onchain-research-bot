const axios = require("axios");

const CHAIN_TO_MOBULA = {
  ethereum: "ethereum",
  bsc: "bnb",
  polygon: "polygon",
  arbitrum: "arbitrum",
  optimism: "optimism",
  base: "base",
  avalanche: "avalanche",
  fantom: "fantom",
  solana: "solana",
};

async function getAthAtlFromMobula(tokenAddress, chainId, currentSupply) {
  if (!tokenAddress) return null;
  const blockchain = CHAIN_TO_MOBULA[chainId];

  try {
    const { data } = await axios.get("https://api.mobula.io/api/1/market/history", {
      params: { asset: tokenAddress, blockchain },
      headers: { Authorization: process.env.MOBULA_API_KEY },
      timeout: 10000,
    });

    const history = data?.data?.price_history;
    if (!history || !history.length) return null;

    let athPrice = 0, atlPrice = Infinity;

    for (const point of history) {
      const price = point[1];
      if (price > athPrice) athPrice = price;
      if (price < atlPrice) atlPrice = price;
    }

    if (athPrice === 0) return null;

    return {
      athPrice,
      athPriceDate: null,
      atlPrice,
      atlPriceDate: null,
      athMarketCap: currentSupply ? athPrice * currentSupply : null,
      atlMarketCap: currentSupply ? atlPrice * currentSupply : null,
    };
  } catch (err) {
    console.error("Mobula error:", err.response?.data || err.message);
    return null;
  }
}

module.exports = { getAthAtlFromMobula };
