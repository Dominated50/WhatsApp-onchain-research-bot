const axios = require("axios");

const BASE_URL = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const client = axios.create({
  baseURL: BASE_URL,
  headers: { Authorization: `Bearer ${TOKEN}` },
  timeout: 8000,
});

function keyFor(address) {
  return `athatl:${address.toLowerCase()}`;
}

async function getStoredAthAtl(address) {
  try {
    const { data } = await client.get(`/get/${keyFor(address)}`);
    if (!data?.result) return null;
    return JSON.parse(data.result);
  } catch (err) {
    console.error("ATH/ATL store get error:", err.message);
    return null;
  }
}

async function updateStoredAthAtl(address, fresh) {
  if (!fresh) return fresh;

  try {
    const existing = await getStoredAthAtl(address);

    const merged = {
      athPrice: existing?.athPrice != null && fresh.athPrice != null
        ? Math.max(existing.athPrice, fresh.athPrice)
        : (existing?.athPrice ?? fresh.athPrice ?? null),
      atlPrice: existing?.atlPrice != null && fresh.atlPrice != null
        ? Math.min(existing.atlPrice, fresh.atlPrice)
        : (existing?.atlPrice ?? fresh.atlPrice ?? null),
    };

    // Only write back to Redis if something actually improved
    const improved =
      (fresh.athPrice != null && (!existing || fresh.athPrice > (existing.athPrice ?? 0))) ||
      (fresh.atlPrice != null && (!existing || fresh.atlPrice < (existing.atlPrice ?? Infinity)));

    if (improved) {
      await client.post(`/set/${keyFor(address)}`, JSON.stringify(merged));
    }

    return {
      ...fresh,
      athPrice: merged.athPrice,
      atlPrice: merged.atlPrice,
      athMarketCap: fresh.currentSupply && merged.athPrice ? merged.athPrice * fresh.currentSupply : fresh.athMarketCap,
      atlMarketCap: fresh.currentSupply && merged.atlPrice ? merged.atlPrice * fresh.currentSupply : fresh.atlMarketCap,
    };
  } catch (err) {
    console.error("ATH/ATL store update error:", err.message);
    return fresh; // fail safe: just use today's fresh result if Redis hiccups
  }
}

module.exports = { getStoredAthAtl, updateStoredAthAtl };
