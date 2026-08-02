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

    const athImproved = fresh.athPrice != null && (
  !existing ||
  existing.athPrice == null ||
  fresh.athPrice > existing.athPrice ||
  (fresh.athPrice === existing.athPrice && existing.athMarketCap == null && fresh.athMarketCap != null)
);
const atlImproved = fresh.atlPrice != null && (
  !existing ||
  existing.atlPrice == null ||
  fresh.atlPrice < existing.atlPrice ||
  (fresh.atlPrice === existing.atlPrice && existing.atlMarketCap == null && fresh.atlMarketCap != null)
);
    // Only trust market cap figures that came attached to whichever price actually wins.
    // Never synthesize a market cap ourselves — that's how the trillion-dollar bug happened.
    const result = {
      athPrice: athImproved ? fresh.athPrice : (existing?.athPrice ?? fresh.athPrice ?? null),
      athMarketCap: athImproved ? (fresh.athMarketCap ?? null) : (existing?.athMarketCap ?? null),
      atlPrice: atlImproved ? fresh.atlPrice : (existing?.atlPrice ?? fresh.atlPrice ?? null),
      atlMarketCap: atlImproved ? (fresh.atlMarketCap ?? null) : (existing?.atlMarketCap ?? null),
    };

    if (athImproved || atlImproved) {
      await client.post(`/set/${keyFor(address)}`, JSON.stringify(result));
    }

    return {
      ...fresh,
      ...result,
    };
  } catch (err) {
    console.error("ATH/ATL store update error:", err.message);
    return fresh;
  }
}

module.exports = { getStoredAthAtl, updateStoredAthAtl };
