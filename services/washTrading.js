const axios = require("axios");

const ETHEREUM_CHAIN_ID = 1;

async function getRecentTransfers(tokenAddress) {
  try {
    const { data } = await axios.get("https://api.etherscan.io/v2/api", {
      params: {
        chainid: ETHEREUM_CHAIN_ID,
        module: "account",
        action: "tokentx",
        contractaddress: tokenAddress,
        page: 1,
        offset: 200, // sample the most recent 200 transfers
        sort: "desc",
        apikey: process.env.ETHERSCAN_API_KEY,
      },
      timeout: 10000,
    });

    return Array.isArray(data?.result) ? data.result : [];
  } catch (err) {
    console.error("Etherscan (wash trading) error:", err.response?.data || err.message);
    return [];
  }
}

async function detectWashTrading(tokenAddress, chainId, pairAddress) {
  if (chainId !== "ethereum" || !pairAddress) {
    return { unsupported: true };
  }

  const transfers = await getRecentTransfers(tokenAddress);
  if (!transfers.length) return null;

  const pair = pairAddress.toLowerCase();
  const activity = {}; // wallet -> { buys: 0, sells: 0 }

  for (const tx of transfers) {
    const from = tx.from?.toLowerCase();
    const to = tx.to?.toLowerCase();
    if (!from || !to) continue;

    if (from === pair) {
      // Tokens leaving the pool = a buy by `to`
      activity[to] = activity[to] || { buys: 0, sells: 0 };
      activity[to].buys++;
    } else if (to === pair) {
      // Tokens entering the pool = a sell by `from`
      activity[from] = activity[from] || { buys: 0, sells: 0 };
      activity[from].sells++;
    }
  }

  const suspects = Object.entries(activity)
    .filter(([, a]) => a.buys >= 3 && a.sells >= 3)
    .map(([address, a]) => ({ address, buys: a.buys, sells: a.sells }));

  if (!suspects.length) return null;

  return { suspects, sampleSize: transfers.length };
}

module.exports = { detectWashTrading };
