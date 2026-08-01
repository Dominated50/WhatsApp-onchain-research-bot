const axios = require("axios");

const CHAIN_TO_ETHERSCAN_ID = {
  ethereum: 1,
  bsc: 56,
  polygon: 137,
  arbitrum: 42161,
  optimism: 10,
  base: 8453,
  avalanche: 43114,
  fantom: 250,
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Finds a wallet's very first incoming transaction — tells us when it
// became active, and who funded it.
async function getFirstIncomingTx(address, chainId) {
  try {
    const { data } = await axios.get("https://api.etherscan.io/v2/api", {
      params: {
        chainid: chainId,
        module: "account",
        action: "txlist",
        address,
        startblock: 0,
        endblock: 99999999,
        page: 1,
        offset: 20, // check first 20 txs to reliably find the first *incoming* one
        sort: "asc",
        apikey: process.env.ETHERSCAN_API_KEY,
      },
      timeout: 10000,
    });

    const txs = data?.result;
    if (!Array.isArray(txs) || !txs.length) return null;

    const firstIncoming = txs.find(
      (tx) => tx.to?.toLowerCase() === address.toLowerCase()
    );
    if (!firstIncoming) return null;

    return {
      timestamp: parseInt(firstIncoming.timeStamp) * 1000,
      fundedBy: firstIncoming.from?.toLowerCase() || null,
    };
  } catch (err) {
    console.error("Etherscan error:", err.response?.data || err.message);
    return null;
  }
}

async function analyzeWallets(holders, chainId, pairCreatedAt) {
  const chain = CHAIN_TO_ETHERSCAN_ID[chainId];
  if (!chain || !holders || !holders.length) return null;

  // Only check top 10 holders to keep this fast and within rate limits
  const topHolders = holders.slice(0, 10);
  const snipers = [];
  const funderMap = {}; // fundedBy address -> [holder addresses]

  for (const h of topHolders) {
    if (!h.address) continue;
    const info = await getFirstIncomingTx(h.address, chain);
    await sleep(250); // stay safely under Etherscan's rate limit

    if (!info) continue;

    // Sniper check: did they receive tokens within 10 minutes of pool creation?
    if (pairCreatedAt && info.timestamp - pairCreatedAt < 10 * 60 * 1000 && info.timestamp - pairCreatedAt >= 0) {
      snipers.push({ address: h.address, percent: h.percent });
    }

    // Clustering check: group holders funded by the same wallet
    if (info.fundedBy) {
      if (!funderMap[info.fundedBy]) funderMap[info.fundedBy] = [];
      funderMap[info.fundedBy].push(h.address);
    }
  }

  const clusters = Object.entries(funderMap)
    .filter(([, addrs]) => addrs.length >= 2)
    .map(([funder, addrs]) => ({ funder, addresses: addrs }));

  if (!snipers.length && !clusters.length) return null;

  return { snipers, clusters };
}

module.exports = { analyzeWallets };
