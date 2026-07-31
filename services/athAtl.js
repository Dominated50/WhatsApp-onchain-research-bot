const { getAthAtlFromBirdeye } = require("./birdeye");
const { getAthAtlFromCoinStats } = require("./coinstats");
const { getAthAtlFromPool } = require("./geckoterminal");
const { getAthAtlFromMobula } = require("./mobula");

async function getBestAthAtl(dex, currentSupply, cg) {
  // If the token is listed on CoinGecko, trust their number first —
  // it tracks the token's full history, not just one trading pool.
  if (cg?.listed && cg.ath) {
    return {
      athPrice: cg.ath,
      athPriceDate: null,
      atlPrice: cg.atl,
      atlPriceDate: null,
      athMarketCap: currentSupply ? cg.ath * currentSupply : null,
      atlMarketCap: currentSupply && cg.atl ? cg.atl * currentSupply : null,
    };
  }

  const tokenAddress = dex.baseToken?.address;
  const results = [];

  if (dex.chainId === "solana") {
    const b = await getAthAtlFromBirdeye(tokenAddress, dex.chainId, currentSupply);
    if (b) results.push(b);
  }

  const cs = await getAthAtlFromCoinStats(tokenAddress, dex.chainId, currentSupply);
  if (cs) results.push(cs);

  const gt = await getAthAtlFromPool(dex.pairAddress, dex.chainId, currentSupply);
  if (gt) results.push(gt);

  const mb = await getAthAtlFromMobula(tokenAddress, dex.chainId, currentSupply);
  if (mb) results.push(mb);

  if (!results.length) return null;

  const athPrices = results.map(r => r.athPrice).filter(v => v != null && v > 0);
  const atlPrices = results.map(r => r.atlPrice).filter(v => v != null && v > 0);

  if (!athPrices.length && !atlPrices.length) return null;

  const athPrice = athPrices.length ? Math.max(...athPrices) : null;
  const atlPrice = atlPrices.length ? Math.min(...atlPrices) : null;

  return {
    athPrice,
    atlPrice,
    athPriceDate: null,
    atlPriceDate: null,
    athMarketCap: currentSupply && athPrice ? athPrice * currentSupply : null,
    atlMarketCap: currentSupply && atlPrice ? atlPrice * currentSupply : null,
  };
}

module.exports = { getBestAthAtl };
