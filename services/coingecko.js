function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getCoingeckoListing(address, dexChainId, retrying = false) {
  const platform = DEXSCREENER_TO_COINGECKO[dexChainId];
  if (!platform) return null;

  try {
    const { data } = await axios.get(
      `https://api.coingecko.com/api/v3/coins/${platform}/contract/${address.toLowerCase()}`,
      { timeout: 8000 }
    );

    if (!data?.id) return null;

    return {
      listed: true,
      coingeckoId: data.id,
      rank: data.market_cap_rank || null,
      url: `https://www.coingecko.com/en/coins/${data.id}`,
    };
  } catch (err) {
    if (err.response?.status === 404) {
      return { listed: false };
    }
    if (err.response?.status === 429 && !retrying) {
      await sleep(2500); // back off briefly, then try once more
      return getCoingeckoListing(address, dexChainId, true);
    }
    console.error("CoinGecko error:", err.message);
    return null;
  }
}
