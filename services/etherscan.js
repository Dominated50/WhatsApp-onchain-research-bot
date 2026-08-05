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

/**
 * Fetches recent ERC20 token transfers for a wallet on a given chain.
 * If sinceBlock is provided, only returns transfers newer than that block.
 * Returns transfers oldest-first so notifications go out in order.
 */
async function getWalletTokenActivity(address, chainId, sinceBlock) {
  const chainNum = CHAIN_TO_ID[chainId];
  if (!chainNum) return null;

  try {
    const { data } = await axios.get("https://api.etherscan.io/v2/api", {
      params: {
        chainid: chainNum,
        module: "account",
        action: "tokentx",
        address,
        sort: "desc",
        page: 1,
        offset: 20,
        apikey: process.env.ETHERSCAN_API_KEY,
      },
      timeout: 10000,
    });

    if (data.status !== "1" || !Array.isArray(data.result)) return [];

    let txs = data.result;
    if (sinceBlock) {
      txs = txs.filter((t) => Number(t.blockNumber) > sinceBlock);
    }

    txs.reverse(); // oldest first, so we notify in chronological order

    return txs.map((t) => {
      const decimals = Number(t.tokenDecimal) || 18;
      const amount = Number(t.value) / Math.pow(10, decimals);
      const direction = t.to.toLowerCase() === address.toLowerCase() ? "buy" : "sell";

      return {
        hash: t.hash,
        blockNumber: Number(t.blockNumber),
        direction, // "buy" = received tokens, "sell" = sent tokens
        tokenSymbol: t.tokenSymbol,
        tokenName: t.tokenName,
        tokenAddress: t.contractAddress,
        amount,
        timestamp: Number(t.timeStamp) * 1000,
      };
    });
  } catch (err) {
    console.error("Etherscan wallet activity error:", err.message);
    return null;
  }
}

module.exports = { getWalletTokenActivity, CHAIN_TO_ID };
