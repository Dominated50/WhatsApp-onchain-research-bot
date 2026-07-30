const axios = require("axios");

// Maps Dexscreener's chainId strings to GeckoTerminal's network id format
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

/**
 * Calculates ATH/ATL from raw OHLCV candle history on GeckoTerminal.
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

    return {
      athPrice,
      athPriceDate: athTime * 1000,
      atlPrice,
      atlPriceDate: atlTime * 1000,
      athMarketCap: currentSupply ? athPrice * currentSupply : null,
      atlMarketCap: currentSupply ? atlPrice * currentSupply : null,
    };
  } catch (err) {
    if (err.response?.status === 429 && !retrying) {
      await sleep(2500);
      return getAthAtlFromPool(pairAddress, dexChainId, currentSupply, true);
    }
    console.error("GeckoTerminal error:", err.message);
    return null;
  }
}

module.exports = { getAthAtlFromPool };
