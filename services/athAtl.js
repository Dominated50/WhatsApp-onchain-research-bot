const { getAthAtlFromBirdeye } = require("./birdeye");
const { getAthAtlFromCoinStats } = require("./coinstats");
const { getAthAtlFromPool } = require("./geckoterminal");
const { getAthAtlFromMobula } = require("./mobula");
const { getHistoricalMarketCapRange } = require("./coingecko");
const { updateStoredAthAtl } = require("./athAtlStore");

async function getBestAthAtl(dex, currentSupply, cg) {
  // If the token is listed on CoinGecko, trust their number first —
  // it tracks the token's full history, not just one trading pool.
  if (cg?.listed && cg.ath) {
    const athWithinRange = cg.athDate && (Date.now() - new Date(cg.athDate).getTime()) < 365 * 24 * 60 * 60 * 1000;
    const atlWithinRange = cg.atlDate && (Date.now() - new Date(cg.atlDate).getTime()) < 365 * 24 * 60 * 60 * 1000;

    let capHistory = null;
    if (athWithinRange || atlWithinRange) {
      capHistory = await getHistoricalMarketCapRange(cg.coingeckoId);
    }

    const freshCg = {
      athPrice: cg.ath,
      athPriceDate: null,
      atlPrice: cg.atl,
      atlPriceDate: null,
      athMarketCap: athWithinRange ? (capHistory?.athMarketCap || null) : null,
      atlMarketCap: atlWithinRange ? (capHistory?.atlMarketCap || null) : null,
      currentSupply,
    };
    return await updateStoredAthAtl(dex.baseToken?.address, freshCg);
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

  const freshCombined = {
  athPrice,
  atlPrice,
  athPriceDate: null,
  atlPriceDate: null,
  athMarketCap: currentSupply && athPrice ? athPrice * currentSupply : null,
  atlMarketCap: currentSupply && atlPrice ? atlPrice * currentSupply : null,
  currentSupply,
};
return await updateStoredAthAtl(tokenAddress, freshCombined);
}

module.exports = { getBestAthAtl };
