const axios = require("axios");

const CHAIN_TO_ID = {
  ethereum: 1,
  bsc: 56,
  polygon: 137,
  arbitrum: 42161,
  optimism: 10,
  base: 8453,
  avalanche: 43114,
  fantom: 250,
};

async function etherscanGet(params) {
  const { data } = await axios.get("https://api.etherscan.io/v2/api", {
    params: { ...params, apikey: process.env.ETHERSCAN_API_KEY },
    timeout: 10000,
  });
  return data;
}

/**
 * Fetches confirmed DEX swap transactions for a wallet on a given chain.
 * Identifies swaps by matching decoded function names containing "swap",
 * then pairs up the token transfers within that same transaction.
 */
async function getWalletSwaps(address, chainId, sinceBlock) {
  const chainNum = CHAIN_TO_ID[chainId];
  if (!chainNum) return null;

  try {
    const [txListRes, tokenTxRes] = await Promise.all([
      etherscanGet({
        chainid: chainNum,
        module: "account",
        action: "txlist",
        address,
        sort: "desc",
        page: 1,
        offset: 30,
      }),
      etherscanGet({
        chainid: chainNum,
        module: "account",
        action: "tokentx",
        address,
        sort: "desc",
        page: 1,
        offset: 60,
      }),
    ]);

    if (txListRes.status !== "1" || !Array.isArray(txListRes.result)) return [];
    if (tokenTxRes.status !== "1" || !Array.isArray(tokenTxRes.result)) return [];

    // Identify swap transactions by decoded function name
    const swapHashes = new Set(
      txListRes.result
        .filter((tx) => (tx.functionName || "").toLowerCase().includes("swap"))
        .filter((tx) => !sinceBlock || Number(tx.blockNumber) > sinceBlock)
        .map((tx) => tx.hash)
    );

    if (!swapHashes.size) return [];

    // Group token transfers by transaction hash
    const transfersByHash = {};
    for (const t of tokenTxRes.result) {
      if (!swapHashes.has(t.hash)) continue;
      if (!transfersByHash[t.hash]) transfersByHash[t.hash] = [];
      transfersByHash[t.hash].push(t);
    }

    const swaps = [];
    for (const hash of swapHashes) {
      const transfers = transfersByHash[hash];
      if (!transfers || !transfers.length) continue; // swap of native token with no ERC20 leg visible yet

      const sold = transfers.find((t) => t.from.toLowerCase() === address.toLowerCase());
      const bought = transfers.find((t) => t.to.toLowerCase() === address.toLowerCase());

      const parentTx = txListRes.result.find((tx) => tx.hash === hash);

      swaps.push({
        hash,
        blockNumber: Number(parentTx?.blockNumber || transfers[0].blockNumber),
        timestamp: Number(parentTx?.timeStamp || transfers[0].timeStamp) * 1000,
        sold: sold
          ? {
              symbol: sold.tokenSymbol,
              amount: Number(sold.value) / Math.pow(10, Number(sold.tokenDecimal) || 18),
            }
          : { symbol: "Native", amount: null },
        bought: bought
          ? {
              symbol: bought.tokenSymbol,
              amount: Number(bought.value) / Math.pow(10, Number(bought.tokenDecimal) || 18),
            }
          : { symbol: "Native", amount: null },
      });
    }

    swaps.sort((a, b) => a.blockNumber - b.blockNumber); // oldest first
    return swaps;
  } catch (err) {
    console.error("Etherscan swap detection error:", err.message);
    return null;
  }
}

module.exports = { getWalletSwaps, CHAIN_TO_ID };
