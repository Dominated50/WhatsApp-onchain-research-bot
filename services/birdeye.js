const axios = require("axios");

const CHAIN_TO_BIRDEYE = {
  solana: "solana",
  ethereum: "ethereum",
  bsc: "bsc",
  polygon: "polygon",
  arbitrum: "arbitrum",
  optimism: "optimism",
  base: "base",
  avalanche: "avalanche",
};

async function getAthAtlFromBirdeye(tokenAddress, chainId, currentSupply) {
  const chain = CHAIN_TO_BIRDEYE[chainId];
  if (!chain || !tokenAddress) return null;

  try {
    const now = Math.floor(Date.now() / 1000);
    const fiveYearsAgo = now - 5 * 365 * 24 * 60 * 60; // covers any token's full history

    const { data } = await axios.get(
      "https://public-api.birdeye.so/defi/history_price",
      {
        params: {
          address: tokenAddress,
          address_type: "token",
          type: "1D", // daily candles
          time_from: fiveYearsAgo,
          time_to: now,
        },
        headers: {
          "X-API-KEY": process.env.BIRDEYE_API_KEY,
          "x-chain": chain,
        },
        timeout: 10000,
      }
    );

    const items = data?.data?.items;
    if (!items || !items.length) return null;

    let athPrice = 0, athTime = null, atlPrice = Infinity, atlTime = null;

    for (const point of items) {
      if (point.value > athPrice) { athPrice = point.value; athTime = point.unixTime; }
      if (point.value < atlPrice) { atlPrice = point.value; atlTime = point.unixTime; }
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
    console.error("Birdeye error:", err.message);
    return null;
  }
}
async function getPriceHistoryFromBirdeye(tokenAddress, chainId, days = 30) {
  const chain = CHAIN_TO_BIRDEYE[chainId];
  if (!chain || !tokenAddress) return null;

  try {
    const now = Math.floor(Date.now() / 1000);
    const timeFrom = now - days * 24 * 60 * 60;

    const { data } = await axios.get(
      "https://public-api.birdeye.so/defi/history_price",
      {
        params: {
          address: tokenAddress,
          address_type: "token",
          type: "1D", // daily candles - keeps chart under QuickChart's data point limit
          time_from: timeFrom,
          time_to: now,
        },
        headers: {
          "X-API-KEY": process.env.BIRDEYE_API_KEY,
          "x-chain": chain,
        },
        timeout: 10000,
      }
    );
    async function getOhlcvFromBirdeye(tokenAddress, chainId, days = 30) {
  const chain = CHAIN_TO_BIRDEYE[chainId];
  if (!chain || !tokenAddress) return null;

  try {
    const now = Math.floor(Date.now() / 1000);
    const timeFrom = now - days * 24 * 60 * 60;

    const { data } = await axios.get(
      "https://public-api.birdeye.so/defi/ohlcv",
      {
        params: {
          address: tokenAddress,
          type: "1D",
          time_from: timeFrom,
          time_to: now,
        },
        headers: {
          "X-API-KEY": process.env.BIRDEYE_API_KEY,
          "x-chain": chain,
        },
        timeout: 10000,
      }
    );

    const items = data?.data?.items;
    if (!items || !items.length) return null;

    return items.map((c) => ({
      time: c.unixTime * 1000,
      open: c.o,
      high: c.h,
      low: c.l,
      close: c.c,
    }));
  } catch (err) {
    console.error("Birdeye OHLCV error:", err.message);
    return null;
  }
    }

    const items = data?.data?.items;
    if (!items || !items.length) return null;

    return items.map((point) => ({
      time: point.unixTime * 1000,
      price: point.value,
    }));
  } catch (err) {
    console.error("Birdeye price history error:", err.message);
    return null;
  }
}
module.exports = { getAthAtlFromBirdeye, getPriceHistoryFromBirdeye, getOhlcvFromBirdeye };
