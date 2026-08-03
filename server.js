require("dotenv").config();
const express = require("express");
const axios = require("axios");
const { detectAddressType } = require("./services/chains");
const { getDexscreenerData, searchByName, searchByNameOnChain } = require("./services/dexscreener");
const { getSecurityData } = require("./services/goplus");
const { getCoingeckoListing, getLiveHolderCount } = require("./services/coingecko");
const { getBestAthAtl } = require("./services/athAtl");
const { getCmcListing } = require("./services/coinmarketcap");
const { analyzeWallets } = require("./services/walletAnalysis");
const { detectWashTrading } = require("./services/washTrading");
const { detectDumpsIntoPumps } = require("./services/dumpDetection");
const { buildReport, buildSummary, scoreRisk } = require("./services/report");
const { sendText, markAsRead, sendChartButton, sendImage, sendRefreshButton, sendMoreButton } = require("./services/whatsapp");
const { addToWatchlist, removeFromWatchlist, getWatchlist, isFirstTimeUser } = require("./services/watchlist");
const { buildCompareReport } = require("./services/compare");
const { auditWallet } = require("./services/walletAudit");
const { buildWalletAuditReport } = require("./services/walletAuditReport");
const { getFlagSet, getStoredFlags, storeFlags, findNewFlags } = require("./services/digest");
const { getAllWatchlistUsers } = require("./services/watchlist");
const { extractTextFromImage, extractAddressFromText } = require("./services/ocr");
const { getPriceHistoryFromBirdeye } = require("./services/birdeye");
const { buildChartUrl } = require("./services/chart");

const CHAIN_ALIASES = {
  eth: "ethereum", ethereum: "ethereum",
  bsc: "bsc", binance: "bsc", bnb: "bsc",
  polygon: "polygon", matic: "polygon",
  arbitrum: "arbitrum", arb: "arbitrum",
  optimism: "optimism", op: "optimism",
  base: "base",
  avalanche: "avalanche", avax: "avalanche",
  fantom: "fantom", ftm: "fantom",
  solana: "solana", sol: "solana",
};

function extractChainFromQuery(text) {
  const words = text.toLowerCase().split(/\s+/);
  const lastWord = words[words.length - 1];
  if (CHAIN_ALIASES[lastWord]) {
    return {
      chainId: CHAIN_ALIASES[lastWord],
      nameOnly: words.slice(0, -1).join(" ").replace(/\bon\b\s*$/, "").trim(),
    };
  }
  return null;
}

const app = express();


app.use(express.json());

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN;

// --- Simple in-memory cache & rate limiter (swap for Redis in production) ---
const reportCache = new Map(); // address -> { data, expiresAt }
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

const userLastRequest = new Map(); // phone -> timestamp
const userLastAddress = new Map(); // phone -> last researched contract address
const pendingSearches = new Map(); // phone -> array of search results awaiting a number reply
const MIN_INTERVAL_MS = 5 * 1000; // 5s between requests per user

// --- 1. Webhook verification (Meta calls this once when you set up the webhook) ---
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified.");
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

app.get("/daily-digest", async (req, res) => {
  console.log("🔔 /daily-digest hit at", new Date().toISOString());
  if (req.query.key !== process.env.DIGEST_SECRET) {
    return res.status(403).send("Forbidden");
  }
  res.status(200).send("Digest started");
  runDailyDigest()
    .then(() => console.log("✅ Digest completed successfully"))
    .catch((err) => console.error("❌ Digest run failed:", err));
});
// --- 2. Incoming messages ---
app.post("/webhook", async (req, res) => {
  // Always ack immediately — Meta expects a fast 200, retries otherwise
  res.sendStatus(200);

  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const message = change?.value?.messages?.[0];
    if (!message) return;

    const from = message.from;

    // Handle refresh button taps
  if (message.type === "interactive" && message.interactive?.button_reply) {
  const buttonId = message.interactive.button_reply.id;
  if (buttonId.startsWith("refresh_")) {
    const addr = buttonId.replace("refresh_", "");
    reportCache.delete(addr.toLowerCase());
    const result = await getReport(addr);
    await sendText(from, result.text);
    await sendRefreshButton(from, addr);
    return;
  }
  if (buttonId.startsWith("more_")) {
    const addr = buttonId.replace("more_", "");
    const result = await getReport(addr);
    await sendText(from, result.text);
    if (result.chartUrl) await sendChartButton(from, result.chartUrl);
    await sendRefreshButton(from, addr);
    return;
  }
  }
    // Handle image messages (OCR contract address extraction)
  if (message.type === "image") {
    try {
      const mediaId = message.image.id;
      const mediaUrlRes = await axios.get(
        `https://graph.facebook.com/v20.0/${mediaId}`,
        { headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` } }
      );
      const imageUrl = mediaUrlRes.data.url;

      const imageRes = await axios.get(imageUrl, {
        headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` },
        responseType: "arraybuffer",
      });
      const imageBuffer = Buffer.from(imageRes.data);

      const extractedText = await extractTextFromImage(imageBuffer);
      const found = extractedText ? extractAddressFromText(extractedText) : null;

      if (!found) {
        await sendText(
          from,
          "I couldn't find a contract address in that image — try sending a clearer screenshot or pasting the address directly."
        );
        return;
      }

      const result = await getReport(found.address);
      await sendText(from, result.text);
      if (result.chartUrl) await sendChartButton(from, result.chartUrl);
      await sendRefreshButton(from, found.address);
      return;
    } catch (err) {
      console.error("❌ Image OCR handling failed:", err.message);
      await sendText(
        from,
        "Something went wrong reading that image. Please try again or paste the contract address directly."
      );
      return;
    }
  }

    if (message.type !== "text") return;
    const text = message.text.body.trim();

    markAsRead(message.id);

    // Basic per-user rate limiting
    const last = userLastRequest.get(from) || 0;
    if (Date.now() - last < MIN_INTERVAL_MS) {
      return sendText(from, "⏳ Slow down a bit — one request every few seconds please.");
    }
    userLastRequest.set(from, Date.now());

    if (await isFirstTimeUser(from)) {
      await sendText(
  from,
  [
    "👋 *Welcome to ChainScope.*",
    "",
    "I'm your onchain research assistant — send me a token, and I'll check its price, security, and history before you ever have to open a browser tab.",
    "",
    "*Try it now.* Send me a contract address:",
    "`0x2170ed0880ac9a755fd29b2688956bd959f933f`",
    "",
    "Don't have the address? Just type `research` followed by a name, like `research pepe`.",
    "",
    "Type `menu` anytime to see everything I can do — comparisons, wallet audits, watchlists, and more.",
    "",
    "⚠️ Reports are for research only, not financial advice. Always DYOR.",
  ].join("\n")
);
    }
    const lowerText = text.toLowerCase().trim();
if (lowerText === "menu" || lowerText === "help" || lowerText === "/help") {
  return sendText(
    from,
    [
      "📋 *ChainScope — Full Command List*",
      "",
      "*RESEARCH*",
      "🔍 Send any contract address to research it",
      "🔎 `research <name>` — search by name, e.g. `research pepe`",
      "🔎 `research <name> on <chain>` — narrow to one chain, e.g. `research pepe on ethereum`",
      "📋 `more` — get the full detailed report after any result",
      "",
      "*COMPARE & AUDIT*",
      "⚖️ `compare <address1> <address2>` — see two tokens side by side",
      "👜 `audit <wallet address> <chain>` — check every token a wallet holds for red flags",
      "",
      "*WATCHLIST*",
      "👁️ `watch <address>` — save a token to track",
      "🗑️ `unwatch <address>` — remove a saved token",
      "📋 `my watchlist` — see everything you're tracking",
      "☀️ You'll automatically get a free daily digest each morning for your watchlist — price, movement, and any new red flags",
      "",
      "*SUPPORTED CHAINS*",
      "Ethereum, BSC, Base, Polygon, Arbitrum, Optimism, Avalanche, Fantom, and Solana",
      "",
      "⚠️ Token names can be faked by scammers — always verify the contract address. Reports are for research only, not financial advice. Always DYOR.",
    ].join("\n")
  );
    }
    if (lowerText === "more") {
  const addr = userLastAddress.get(from);
  if (!addr) return sendText(from, "I don't have a recent token to expand on — send me a contract address first.");
  const result = await getReport(addr);
  await sendText(from, result.text);
  if (result.chartUrl) await sendChartButton(from, result.chartUrl);
  await sendRefreshButton(from, addr);
  return;
    }
    if (lowerText.startsWith("compare ")) {
  const addresses = text.slice(8).trim().split(/\s+/).filter((w) => extractAddress(w));

  if (addresses.length < 2) {
    return sendText(from, "Send two contract addresses to compare, e.g.:\n`compare 0xABC... 0xDEF...`");
  }

  await sendText(from, `⚖️ Comparing both tokens... give me a few seconds.`);

  const [resultA, resultB] = await Promise.all([
    getReport(addresses[0]),
    getReport(addresses[1]),
  ]);

  const comparison = buildCompareReport(resultA, resultB);
  return sendText(from, comparison);
    }
    if (lowerText.startsWith("audit ")) {
  const parts = text.slice(6).trim().split(/\s+/);
  const walletAddr = parts[0];
  const rawChain = parts[1]?.toLowerCase();
  const chain = CHAIN_ALIASES[rawChain];

  if (!walletAddr || !chain) {
    return sendText(from, "Usage: `audit <wallet address> <chain>` — e.g. `audit 0x791f... ethereum`");
  }

  await sendText(from, `🔍 Auditing your wallet on ${chain}... this may take a moment.`);
  const audit = await auditWallet(walletAddr, chain);
  const report = buildWalletAuditReport(audit, walletAddr, chain);
  return sendText(from, report);
    }
    
    if (lowerText.startsWith("chart ")) {
    const address = extractAddress(text);
    if (!address) return sendText(from, "Send a valid contract address to chart, e.g. `chart 0x2170ed0880ac9a755fd29b2688956bd959f933f`");

    await sendText(from, `📈 Generating price chart for \`${address}\`... give me a few seconds.`);

    const dex = await getDexscreenerData(address);
    if (!dex) return sendText(from, "Couldn't find trading data for that token — check the address and try again.");

    const priceHistory = await getPriceHistoryFromBirdeye(address, dex.chainId, 30);
    if (!priceHistory) {
      return sendText(from, "Sorry, I couldn't generate a price chart for this token right now — historical data may not be available yet.");
    }

    const tokenName = dex.baseToken?.symbol || dex.baseToken?.name || "Token";
    const chartImageUrl = buildChartUrl(priceHistory, tokenName);
    if (!chartImageUrl) return sendText(from, "Sorry, something went wrong building that chart.");

    await sendImage(from, chartImageUrl, `${tokenName} — Last 30 Days`);
    return;
      }
    if (lowerText.startsWith("research ")) {
  const rawQuery = text.slice(9).trim();
  if (!rawQuery) return sendText(from, "Tell me a token name to search, e.g. `research pepe` or `research pepe on ethereum`");

  const chainMatch = extractChainFromQuery(rawQuery);
  const query = chainMatch ? chainMatch.nameOnly : rawQuery;
  if (!query) return sendText(from, "Please include a token name, e.g. `research pepe on ethereum`");

  const results = chainMatch
    ? await searchByNameOnChain(query, chainMatch.chainId)
    : await searchByName(query);
  if (!results.length) {
    return sendText(from, `No tokens found matching "${query}". Try the exact contract address instead for guaranteed accuracy.`);
  }

  pendingSearches.set(from, results);

  let msg = `🔎 Found ${results.length} match(es) for "${query}":\n\n`;
  results.forEach((r, i) => {
    msg += `${i + 1}. *${r.name} (${r.symbol})* — ${r.chainId}\n   Liquidity: $${r.liquidityUsd.toLocaleString()}\n   \`${r.address}\`\n\n`;
  });
  msg += `⚠️ *Names can be faked by scammers.* Verify the contract address matches the official one before trusting any result.\n\nReply with a number (1-${results.length}) to research that token.`;

  return sendText(from, msg);
}

if (/^[1-5]$/.test(lowerText) && pendingSearches.has(from)) {
  const results = pendingSearches.get(from);
  const choice = results[parseInt(lowerText) - 1];
  if (!choice) return sendText(from, "Invalid number — please reply with a valid option from the list.");
  pendingSearches.delete(from);
  const address = choice.address;
  await sendText(from, `🔬 Researching \`${address}\`... give me a few seconds.`);
  const result = await getReport(address);
  userLastAddress.set(from, address);
  if (result.imageUrl) await sendImage(from, result.imageUrl, `${result.symbol || "Token"} logo`);
  await sendText(from, result.summary);
  await sendMoreButton(from, address);
  return;
}

    if (lowerText === "my watchlist" || lowerText === "watchlist") {
      const list = await getWatchlist(from);
      if (!list.length) {
        return sendText(from, "Your watchlist is empty. Add one with:\n`watch <contract address>`");
      }
      await sendText(from, `📋 Checking your ${list.length} watched token(s)...`);
     for (const addr of list) {
  if (list.indexOf(addr) > 0) await new Promise((r) => setTimeout(r, 1500));
  const result = await getReport(addr);
  if (result.imageUrl) await sendImage(from, result.imageUrl, `${result.symbol || "Token"} logo`);
  await sendText(from, result.text);
  if (result.chartUrl) await sendChartButton(from, result.chartUrl);
  await sendRefreshButton(from, addr);
}
return; 
    }
    if (lowerText.startsWith("watch ")) {
      const addr = extractAddress(text);
      if (!addr) return sendText(from, "⚠️ Couldn't find a valid address in that message.");
      await addToWatchlist(from, addr);
      return sendText(from, `✅ Added \`${addr}\` to your watchlist. Send *my watchlist* anytime to check them.`);
    }

    if (lowerText.startsWith("unwatch ")) {
      const addr = extractAddress(text);
      if (!addr) return sendText(from, "⚠️ Couldn't find a valid address in that message.");
      await removeFromWatchlist(from, addr);
      return sendText(from, `🗑️ Removed \`${addr}\` from your watchlist.`);
    } 
    const address = extractAddress(text);
    if (!address) {
      return sendText(
        from,
        "👋 Send me a token contract address (CA) and I'll pull an onchain research report.\n\nExample:\n`0x2170ed0880ac9a755fd29b2688956bd959f933f`"
      );
    }

    const addrType = detectAddressType(address);
    if (addrType === "unknown") {
      return sendText(from, "⚠️ That doesn't look like a valid EVM or Solana contract address.");
    }

    // Immediate ack so the user knows we're working (data pulls take a few seconds)
    await sendText(from, `🔎 Researching \`${address}\`... give me a few seconds.`);


      const result = await getReport(address);
userLastAddress.set(from, address);
if (result.imageUrl) await sendImage(from, result.imageUrl, `${result.name || result.symbol || "Token"}`);
await sendText(from, result.summary);
await sendMoreButton(from, address);
  } catch (err) {
      console.error("Handler error:", err);
  }
});

// --- Core research orchestration, with caching ---
async function getReport(address) {
  const cached = reportCache.get(address.toLowerCase());
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const dex = await getDexscreenerData(address);
  const sec = dex ? await getSecurityData(address, dex.chainId) : null;
  const cg = dex ? await getCoingeckoListing(address, dex.chainId) : null;
  const liveHolderCount = dex ? await getLiveHolderCount(dex.baseToken?.address || address, dex.chainId) : null;
  const cmc = dex ? await getCmcListing(address, dex.chainId) : null; 
  console.log("Wallet check — holders:", sec?.holders?.length, "chainId:", dex?.chainId, "pairCreatedAt:", dex?.pairCreatedAt);
const wallets = sec?.holders && dex?.chainId && dex?.pairCreatedAt
  ? await analyzeWallets(sec.holders, dex.chainId, dex.pairCreatedAt)
  : null;
  const washTrading = dex?.chainId && dex?.pairAddress
  ? await detectWashTrading(dex.baseToken?.address, dex.chainId, dex.pairAddress)
  : null;
  const dumps = dex?.chainId && dex?.pairAddress
  ? await detectDumpsIntoPumps(dex.baseToken?.address, dex.chainId, dex.pairAddress)
  : null;
console.log("Wallet analysis result:", JSON.stringify(wallets));
  let athAtl = null;
if (dex?.pairAddress && dex?.priceUsd && dex?.marketCap) {
  const estimatedSupply = dex.marketCap / parseFloat(dex.priceUsd);
  athAtl = await getBestAthAtl(dex, estimatedSupply, cg);
}
  const report = buildReport(address, dex, sec, cg, cmc, athAtl, wallets, washTrading, dumps, liveHolderCount);
const summary = buildSummary(address, dex, sec, athAtl, wallets, washTrading, dumps);
const risk = scoreRisk(dex, sec);
const result = { text: report, summary, chartUrl: dex?.url || null, imageUrl: dex?.imageUrl || null, symbol: dex?.baseToken?.symbol, name: dex?.baseToken?.name, dex, sec, athAtl, risk, wallets, washTrading, dumps };

  reportCache.set(address.toLowerCase(), {
    data: result,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return result;
}


// --- Pull a contract address out of free-form text ---
function extractAddress(text) {
  const evmMatch = text.match(/0x[a-fA-F0-9]{40}/);
  if (evmMatch) return evmMatch[0];

  const solMatch = text.match(/\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/);
  if (solMatch) return solMatch[0];

  return null;
}
async function runDailyDigest() {
  const users = await getAllWatchlistUsers();
  console.log(`Running daily digest for ${users.length} user(s)`);

  for (const phone of users) {
    const list = await getWatchlist(phone);
    if (!list.length) continue;

    const lines = [`☀️ *Good morning! Here's your watchlist update:*`, ``];

    for (const addr of list) {
      try {
        const result = await getReport(addr);
        const flags = getFlagSet(result.sec, result.wallets, result.washTrading, result.dumps);
        const oldFlags = await getStoredFlags(addr);
        const newFlags = findNewFlags(oldFlags, flags);
        await storeFlags(addr, flags);

        const symbol = result.symbol || "???";
        const price = result.dex?.priceUsd || "N/A";
        const change = result.dex?.priceChange24h;
        const changeStr = change != null ? `${change > 0 ? "+" : ""}${change}%` : "N/A";

        lines.push(`*${symbol}*: $${price} (${changeStr} 24h)`);
        if (newFlags.length) {
          newFlags.forEach((f) => lines.push(`  ${f}`));
        }
        lines.push(``);

        await new Promise((r) => setTimeout(r, 500));
      } catch (err) {
        console.error(`Digest error for ${addr}:`, err.message);
      }
    }

    lines.push(`_Reply "my watchlist" anytime for full details._`);
    await sendText(phone, lines.join("\n"));
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log("Daily digest complete.");
}

app.listen(PORT, () => {
  console.log(`WhatsApp onchain bot listening on port ${PORT}`);
});
