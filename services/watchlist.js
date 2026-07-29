const axios = require("axios");

const BASE_URL = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const client = axios.create({
  baseURL: BASE_URL,
  headers: { Authorization: `Bearer ${TOKEN}` },
  timeout: 8000,
});

function keyFor(phone) {
  return `watchlist:${phone}`;
}

async function addToWatchlist(phone, address) {
  try {
    await client.get(`/sadd/${keyFor(phone)}/${address.toLowerCase()}`);
    return true;
  } catch (err) {
    console.error("Watchlist add error:", err.message);
    return false;
  }
}

async function removeFromWatchlist(phone, address) {
  try {
    await client.get(`/srem/${keyFor(phone)}/${address.toLowerCase()}`);
    return true;
  } catch (err) {
    console.error("Watchlist remove error:", err.message);
    return false;
  }
}

async function getWatchlist(phone) {
  try {
    const { data } = await client.get(`/smembers/${keyFor(phone)}`);
    return data?.result || [];
  } catch (err) {
    console.error("Watchlist get error:", err.message);
    return [];
  }
}

async function isFirstTimeUser(phone) {
  try {
    const { data } = await client.get(`/get/seen:${phone}`);
    if (data?.result) return false;
    await client.get(`/set/seen:${phone}/1`);
    return true;
  } catch (err) {
    console.error("First-time check error:", err.message);
    return false; // fail safe: don't spam onboarding if Redis hiccups
  }
}

module.exports = { addToWatchlist, removeFromWatchlist, getWatchlist, isFirstTimeUser };
