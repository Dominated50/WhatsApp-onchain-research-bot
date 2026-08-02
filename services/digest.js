const axios = require("axios");
const { getAllWatchlistUsers, getWatchlist } = require("./watchlist");
const { sendText } = require("./whatsapp");

const BASE_URL = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const redisClient = axios.create({
  baseURL: BASE_URL,
  headers: { Authorization: `Bearer ${TOKEN}` },
  timeout: 8000,
});

function getFlagSet(sec, wallets, washTrading, dumps) {
  return {
    honeypot: !!sec?.isHoneypot,
    highBuyTax: sec?.buyTax != null && parseFloat(sec.buyTax) > 10,
    highSellTax: sec?.sellTax != null && parseFloat(sec.sellTax) > 10,
    lpUnlocked: sec?.lpLockedPct === 0,
    sniper: !!(wallets?.snipers?.length),
    cluster: !!(wallets?.clusters?.length),
    washTrading: !!(washTrading?.suspects?.length),
    dump: !!(dumps?.dumps?.length),
  };
}

async function getStoredFlags(address) {
  try {
    const { data } = await redisClient.get(`/get/flagstate:${address.toLowerCase()}`);
    return data?.result ? JSON.parse(data.result) : null;
  } catch (err) {
    return null;
  }
}

async function storeFlags(address, flags) {
  try {
    await redisClient.post(`/set/flagstate:${address.toLowerCase()}`, JSON.stringify(flags));
  } catch (err) {
    console.error("Store flags error:", err.message);
  }
}

const FLAG_LABELS = {
  honeypot: "🚨 Became a honeypot",
  highBuyTax: "⚠️ Buy tax spiked above 10%",
  highSellTax: "⚠️ Sell tax spiked above 10%",
  lpUnlocked: "⚠️ Liquidity is no longer locked",
  sniper: "🎯 Sniper wallets detected",
  cluster: "🕸️ Wallet clustering detected",
  washTrading: "🔁 Wash trading detected",
  dump: "📉 Large dumps during pumps detected",
};

function findNewFlags(oldFlags, newFlags) {
  if (!oldFlags) return []; // first time seeing this token, don't flood with "new" flags
  const newlyTrue = [];
  for (const key of Object.keys(newFlags)) {
    if (newFlags[key] && !oldFlags[key]) newlyTrue.push(FLAG_LABELS[key]);
  }
  return newlyTrue;
}

module.exports = { getFlagSet, getStoredFlags, storeFlags, findNewFlags };
