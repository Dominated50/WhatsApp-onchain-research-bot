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
      priceChange6h: bestPair.priceChange?.h6,
      priceChange1h: bestPair.priceChange?.h1,
      volume6h: bestPair.volume?.h6,
      volume1h: bestPair.volume?.h1,
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
async function searchByName(query) {
  try {
    const { data } = await axios.get(
      `https://api.dexscreener.com/latest/dex/search`,
      { params: { q: query }, timeout: 8000 }
    );

    if (!data?.pairs?.length) return [];

    // Sort by liquidity, highest first, and take the top 5 distinct tokens
    const sorted = data.pairs
      .filter((p) => p.liquidity?.usd)
      .sort((a, b) => (b.liquidity.usd || 0) - (a.liquidity.usd || 0));

    const seen = new Set();
    const results = [];
    for (const p of sorted) {
      const addr = p.baseToken?.address?.toLowerCase();
      if (!addr || seen.has(addr)) continue;
      seen.add(addr);
      results.push({
        name: p.baseToken?.name || "Unknown",
        symbol: p.baseToken?.symbol || "???",
        address: p.baseToken?.address,
        chainId: p.chainId,
        liquidityUsd: p.liquidity?.usd || 0,
      });
      if (results.length >= 5) break;
    }

    return results;
  } catch (err) {
    console.error("Dexscreener search error:", err.message);
    return [];
  }
}

module.exports = { getDexscreenerData, searchByName };
