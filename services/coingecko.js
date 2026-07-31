const axios = require("axios");

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getCoingeckoListing(address, dexChainId, retrying = false) {
  const platform = DEXSCREENER_TO_COINGECKO[dexChainId];
  if (!platform) return null;

  try {
    const { data } = await axios.get(
      `https://api.coingecko.com/api/v3/coins/${platform}/contract/${address}`,
      {
        timeout: 8000,
        headers: { "x-cg-demo-api-key": process.env.COINGECKO_API_KEY },
      }
    );

    if (!data?.id) return null;

    return {
      listed: true,
      coingeckoId: data.id,
      rank: data.market_cap_rank || null,
      url: `https://www.coingecko.com/en/coins/${data.id}`,
      ath: data.market_data?.ath?.usd || null,
      athDate: data.market_data?.ath_date?.usd || null,
      atl: data.market_data?.atl?.usd || null,
      atlDate: data.market_data?.atl_date?.usd || null,
    };
  } catch (err) {
    if (err.response?.status === 404) {
      return { listed: false };
    }
    if (err.response?.status === 429 && !retrying) {
      await sleep(2500);
      return getCoingeckoListing(address, dexChainId, true);
    }
    console.error("CoinGecko error:", err.message);
    return null;
  }
}

module.exports = { getCoingeckoListing };
