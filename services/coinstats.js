const axios = require("axios");

// CoinStats' blockchain name format (confirmed via their official API docs)
const CHAIN_TO_COINSTATS = {
  ethereum: "ethereum",
  bsc: "binance-smart-chain",
  polygon: "polygon",
  arbitrum: "arbitrum",
  optimism: "optimism",
  base: "base",
  avalanche: "avalanche",
  fantom: "fantom",
  solana: "solana",
};

async function getAthAtlFromCoinStats(tokenAddress, chainId, currentSupply) {
  if (!tokenAddress) return null;
  const blockchain = CHAIN_TO_COINSTATS[chainId];

  try {
    // First attempt: filter by both address and blockchain (fastest, most precise)
    let coin = await lookupCoin(tokenAddress, blockchain);

    // Fallback: if nothing found, try without the blockchain filter
    // (in case our chain-name mapping doesn't match CoinStats' internal naming)
    if (!coin && blockchain) {
      coin = await lookupCoin(tokenAddress, null);
    }

    if (!coin || (coin.allTimeHigh == null && coin.allTimeLow == null)) return null;

    const athPrice = coin.allTimeHigh ?? null;
    const atlPrice = coin.allTimeLow ?? null;

    return {
      athPrice,
      athPriceDate: null, // CoinStats doesn't return the date, only the price
      atlPrice,
      atlPriceDate: null,
      athMarketCap: currentSupply && athPrice ? athPrice * currentSupply : null,
      atlMarketCap: currentSupply && atlPrice ? atlPrice * currentSupply : null,
    };
  } catch (err) {
    console.error("CoinStats error:", err.message);
    return null;
  }
}

async function lookupCoin(tokenAddress, blockchain) {
  const params = { contractAddresses: tokenAddress };
  if (blockchain) params.blockchains = blockchain;

  const { data } = await axios.get("https://api.coinstats.app/v1/coins", {
    params,
    headers: { "X-API-KEY": process.env.COINSTATS_API_KEY },
    timeout: 10000,
  });

  return data?.result?.[0] || null;
}

module.exports = { getAthAtlFromCoinStats };
