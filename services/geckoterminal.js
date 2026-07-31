const axios = require("axios");

const DEXSCREENER_TO_GT = {
  ethereum: "eth",
  bsc: "bsc",
  polygon: "polygon_pos",
  arbitrum: "arbitrum",
  optimism: "optimism",
  base: "base",
  avalanche: "avax",
  fantom: "ftm",
  solana: "solana",
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Checks Dexscreener for when the pool was actually created
async function getPoolCreatedAt(pairAddress, dexChainId) {
  try {
    const { data } = await axios.get(
      `https://api.dexscreener.com/latest/dex/pairs/${dexChainId}/${pairAddress}`,
      { timeout: 10000 }
    );
    const pair = data?.pairs?.[0] || data?.pair;
    return pair?.pairCreatedAt || null; // timestamp in ms
  } catch (err) {
    console.error("Dexscreener pool-created lookup error:", err.message);
    return null;
  }
}

async function getAthAtlFromPool(pairAddress, dexChainId, currentSupply, retrying = false) {
  const network = DEXSCREENER_TO_GT[dexChainId];
  if (!network || !pairAddress) return null;

  try {
    const { data } = await axios.get(
      `https://api.geckoterminal.com/api/v2/networks/${network}/pools/${pairAddress}/ohlcv/day`,
      { params: { aggregate: 1, limit: 1000 }, timeout: 10000 }
    );

    const candles = data?.data?.attributes?.ohlcv_list;
    if (!candles || !candles.length) return null;

    let athPrice = 0, athTime = null, atlPrice = Infinity, atlTime = null;

    for (const c of candles) {
      const [ts, , high, low] = c;
      if (high > athPrice) { athPrice = high; athTime = ts; }
      if (low < atlPrice) { atlPrice = low; atlTime = ts; }
    }

    if (!athTime) return null;

    // Check if we might be missing early trading data
    const earliestCandleMs = candles[0][0] * 1000;
    const poolCreatedAtMs = await getPoolCreatedAt(pairAddress, dexChainId);
    const possiblyIncomplete =
      poolCreatedAtMs && earliestCandleMs - poolCreatedAtMs > 24 * 60 * 60 * 1000; // more than 1 day gap

    return {
      athPrice,
      athPriceDate: athTime * 1000,
      atlPrice,
      atlPriceDate: atlTime * 1000,
      athMarketCap: currentSupply ? athPrice * currentSupply : null,
      atlMarketCap: currentSupply ? atlPrice * currentSupply : null,
      possiblyIncomplete,
    };
  } catch (err) {
    if (err.response?.status === 429 && !retrying) {
      await sleep(2500);
      return getAthAtlFromPool(pairAddress, dexChainId, currentSupply, true);
    }
    console.error("GeckoTerminal error:", err.response?.data || err.message);
    return null;
  }
}

module.exports = { getAthAtlFromPool };
