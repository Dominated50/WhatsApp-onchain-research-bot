const axios = require("axios");

const ETHEREUM_CHAIN_ID = 1;

async function getHourlyCandles(pairAddress) {
  try {
    const { data } = await axios.get(
      `https://api.geckoterminal.com/api/v2/networks/eth/pools/${pairAddress}/ohlcv/hour`,
      { params: { aggregate: 1, limit: 100 }, timeout: 10000 }
    );
    return data?.data?.attributes?.ohlcv_list || [];
  } catch (err) {
    console.error("GeckoTerminal (dump detection) error:", err.message);
    return [];
  }
}

async function getSellTransfers(tokenAddress) {
  try {
    const { data } = await axios.get("https://api.etherscan.io/v2/api", {
      params: {
        chainid: ETHEREUM_CHAIN_ID,
        module: "account",
        action: "tokentx",
        contractaddress: tokenAddress,
        page: 1,
        offset: 200,
        sort: "desc",
        apikey: process.env.ETHERSCAN_API_KEY,
      },
      timeout: 10000,
    });
    return Array.isArray(data?.result) ? data.result : [];
  } catch (err) {
    console.error("Etherscan (dump detection) error:", err.response?.data || err.message);
    return [];
  }
}

async function detectDumpsIntoPumps(tokenAddress, chainId, pairAddress) {
  if (chainId !== "ethereum" || !pairAddress || !tokenAddress) {
    return { unsupported: true };
  }

  const [candles, transfers] = await Promise.all([
    getHourlyCandles(pairAddress),
    getSellTransfers(tokenAddress),
  ]);

  if (!candles.length || !transfers.length) return null;

  const pair = pairAddress.toLowerCase();
  const sells = transfers.filter((tx) => tx.to?.toLowerCase() === pair);
  if (!sells.length) return null;

  // Figure out a "large sell" threshold from this token's own sell sizes
  const amounts = sells.map((tx) => parseFloat(tx.value) / Math.pow(10, parseInt(tx.tokenDecimal || 18)));
  const avgSell = amounts.reduce((a, b) => a + b, 0) / amounts.length;
  const largeSellThreshold = avgSell * 3; // 3x the average counts as "large"

  const dumps = [];

  for (let i = 0; i < sells.length; i++) {
    const tx = sells[i];
    const amount = amounts[i];
    if (amount < largeSellThreshold) continue;

    const txTime = parseInt(tx.timeStamp) * 1000;

    // Find the candle this sell happened in, and compare to price 3 hours earlier
    const candleIndex = candles.findIndex((c) => c[0] * 1000 <= txTime);
    if (candleIndex === -1 || candleIndex + 3 >= candles.length) continue;

    const priceAtSell = candles[candleIndex][4]; // close price
    const priceBefore = candles[candleIndex + 3][4]; // 3 hours earlier (candles are newest-first)
    if (!priceBefore || priceBefore === 0) continue;

    const pumpPercent = ((priceAtSell - priceBefore) / priceBefore) * 100;

    if (pumpPercent > 15) {
      dumps.push({
        address: tx.from?.toLowerCase(),
        amount,
        pumpPercent: pumpPercent.toFixed(1),
        timestamp: txTime,
      });
    }
  }

  if (!dumps.length) return null;

  return { dumps };
}

module.exports = { detectDumpsIntoPumps };
