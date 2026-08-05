const axios = require("axios");

const BASE_URL = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const client = axios.create({
  baseURL: BASE_URL,
  headers: { Authorization: `Bearer ${TOKEN}` },
  timeout: 8000,
});

function keyFor(phone) {
  return `tracked_wallets:${phone}`;
}

async function getTrackedWallets(phone) {
  try {
    const { data } = await client.get(`/get/${keyFor(phone)}`);
    if (!data?.result) return [];
    return JSON.parse(data.result);
  } catch (err) {
    console.error("Get tracked wallets error:", err.message);
    return [];
  }
}

async function saveTrackedWallets(phone, wallets) {
  try {
    await client.get(`/set/${keyFor(phone)}/${encodeURIComponent(JSON.stringify(wallets))}`);
    return true;
  } catch (err) {
    console.error("Save tracked wallets error:", err.message);
    return false;
  }
}

async function addTrackedWallet(phone, address, chain) {
  const wallets = await getTrackedWallets(phone);
  const exists = wallets.some(
    (w) => w.address.toLowerCase() === address.toLowerCase() && w.chain === chain
  );
  if (exists) return false;

  wallets.push({ address: address.toLowerCase(), chain, lastSeenBlock: null });
  await saveTrackedWallets(phone, wallets);
  await client.get(`/sadd/tracked_wallet_users/${phone}`);
  return true;
}

async function removeTrackedWallet(phone, address, chain) {
  const wallets = await getTrackedWallets(phone);
  const filtered = wallets.filter(
    (w) => !(w.address.toLowerCase() === address.toLowerCase() && w.chain === chain)
  );
  await saveTrackedWallets(phone, filtered);
  return filtered.length !== wallets.length;
}

async function updateLastSeenBlock(phone, address, chain, blockNumber) {
  const wallets = await getTrackedWallets(phone);
  const wallet = wallets.find(
    (w) => w.address.toLowerCase() === address.toLowerCase() && w.chain === chain
  );
  if (wallet) {
    wallet.lastSeenBlock = blockNumber;
    await saveTrackedWallets(phone, wallets);
  }
}

async function getAllTrackedWalletUsers() {
  try {
    const { data } = await client.get(`/smembers/tracked_wallet_users`);
    return data?.result || [];
  } catch (err) {
    console.error("Get tracked wallet users error:", err.message);
    return [];
  }
}

module.exports = {
  addTrackedWallet,
  removeTrackedWallet,
  getTrackedWallets,
  updateLastSeenBlock,
  getAllTrackedWalletUsers,
};
