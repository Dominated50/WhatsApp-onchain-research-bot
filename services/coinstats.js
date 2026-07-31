const axios = require("axios");

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

// Step 1: find the coin's internal CoinStats ID using its contract address
async function findCoinId(tokenAddress, blockchain) {
  const params = { contractAddresses: tokenAddress };
  if (blockchain) params.blockchains = blockchain;

  const { data } = await axios.get("https://api.coinstats.app/v1/coins", {
    params,
    headers: { "X-API-KEY": process.env.COINSTATS_API_KEY },
    timeout: 10000,
  });

  return data?.result?.[0]?.id || null;
}

// Step 2: pull full price history for that coin and calculate ATH/ATL ourselves
async function getChartAthAtl(coinId, currentSupply) {
  const { data } = await axios.get(
    `https://openapiv1.coinstats.app/coins/${coinId}/charts`,
    {
      params: { period: "all" },
      headers: { "X-API-KEY": process.env.COINSTATS_API_KEY },
      timeout: 10000,
    }
  );

  if (!Array.isArray(data) || !data.length) return null;

  let athPrice = 0, atlPrice = Infinity;

  for (const point of data) {
    const price = point[1]; // [timestamp, price, priceBtc, ...]
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
}

async function getAthAtlFromCoinStats(tokenAddress, chainId, currentSupply) {
  if (!tokenAddress) return null;
  const blockchain = CHAIN_TO_COINSTATS[chainId];

  try {
    let coinId = await findCoinId(tokenAddress, blockchain);
    if (!coinId) coinId = await findCoinId(tokenAddress, null); // fallback without chain filter
    if (!coinId) return null;

    return await getChartAthAtl(coinId, currentSupply);
  } catch (err) {
    console.error("CoinStats error:", err.message);
    return null;
  }
}

module.exports = { getAthAtlFromCoinStats };
