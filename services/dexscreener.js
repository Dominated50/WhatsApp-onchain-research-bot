const axios = require("axios");

/**
 * Fetches token pair data from Dexscreener. Free, no API key required.
 * Returns the most liquid pair for the token, or null if nothing found.
 */
async function getDexscreenerData(contractAddress) {
  try {
    const { data } = await axios.get(
      `https://api.dexscreener.com/latest/dex/tokens/${contractAddress}`,
      { timeout: 8000 }
    );

    if (!data?.pairs?.length) return null;

    // Pick the pair with the highest liquidity — usually the "real" market
    const bestPair = data.pairs.reduce((best, pair) =>
      (pair.liquidity?.usd || 0) > (best.liquidity?.usd || 0) ? pair : best
    );

    return {
      chainId: bestPair.chainId, // e.g. "ethereum", "bsc", "solana"
      allDexes: [...new Set(data.pairs.map((p) => p.dexId))],
      dexId: bestPair.dexId,
      pairAddress: bestPair.pairAddress,
      baseToken: bestPair.baseToken, // { address, name, symbol }
      priceUsd: bestPair.priceUsd,
      priceChange24h: bestPair.priceChange?.h24,
      liquidityUsd: bestPair.liquidity?.usd,
      volume24h: bestPair.volume?.h24,
      fdv: bestPair.fdv,
      marketCap: bestPair.marketCap,
      pairCreatedAt: bestPair.pairCreatedAt,
      url: bestPair.url,
      imageUrl: bestPair.info?.imageUrl || null,
    };
  } catch (err) {
    console.error("Dexscreener error:", err.message);
    return null;
  }
}

module.exports = { getDexscreenerData };
