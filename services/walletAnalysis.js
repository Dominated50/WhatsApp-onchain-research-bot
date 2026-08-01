const axios = require("axios");

const ETHEREUM_CHAIN_ID = 1;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getFirstIncomingTx(address) {
  try {
    const { data } = await axios.get("https://api.etherscan.io/v2/api", {
      params: {
        chainid: ETHEREUM_CHAIN_ID,
        module: "account",
        action: "txlist",
        address,
        startblock: 0,
        endblock: 99999999,
        page: 1,
        offset: 20,
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
  // Only Ethereum mainnet is supported for now — other chains need
  // separate free-tier integrations (BSCTrace, Routescan, etc.)
  if (chainId !== "ethereum") {
    return { unsupported: true };
  }

  if (!holders || !holders.length) return null;

  const topHolders = holders.slice(0, 10);
  const snipers = [];
  const funderMap = {};

  for (const h of topHolders) {
    if (!h.address) continue;
    const info = await getFirstIncomingTx(h.address);
    await sleep(250);

    if (!info) continue;

    if (pairCreatedAt && info.timestamp - pairCreatedAt < 10 * 60 * 1000 && info.timestamp - pairCreatedAt >= 0) {
      snipers.push({ address: h.address, percent: h.percent });
    }

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
