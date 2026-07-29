require("dotenv").config();
const express = require("express");
const { detectAddressType } = require("./services/chains");
const { getDexscreenerData } = require("./services/dexscreener");
const { getSecurityData } = require("./services/goplus");
const { buildReport } = require("./services/report");
const { sendText, markAsRead, sendChartButton, sendImage } = require("./services/whatsapp");
const { addToWatchlist, removeFromWatchlist, getWatchlist } = require("./services/watchlist");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN;

// --- Simple in-memory cache & rate limiter (swap for Redis in production) ---
const reportCache = new Map(); // address -> { data, expiresAt }
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

const userLastRequest = new Map(); // phone -> timestamp
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

// --- 2. Incoming messages ---
app.post("/webhook", async (req, res) => {
  // Always ack immediately — Meta expects a fast 200, retries otherwise
  res.sendStatus(200);

  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const message = change?.value?.messages?.[0];
    if (!message || message.type !== "text") return;

    const from = message.from; // sender's phone number
    const text = message.text.body.trim();

    markAsRead(message.id);

    // Basic per-user rate limiting
    const last = userLastRequest.get(from) || 0;
    if (Date.now() - last < MIN_INTERVAL_MS) {
      return sendText(from, "⏳ Slow down a bit — one request every few seconds please.");
    }
    userLastRequest.set(from, Date.now());

   const lowerText = text.toLowerCase().trim();
    if (lowerText === "menu" || lowerText === "help" || lowerText === "/help") {
      return sendText(
        from,
        `🤖 *ChainScope Commands*\n\n` +
          `🔍 *Check a token*\nJust send a contract address, e.g.\n\`0x2170ed0880ac9a755fd29b2688956bd959f933f\`\n\n` +
          `👁️ *watch <address>*\nAdd a token to your watchlist\n\n` +
          `🗑️ *unwatch <address>*\nRemove a token from your watchlist\n\n` +
          `📋 *my watchlist*\nCheck all your watched tokens at once\n\n` +
          `❓ *menu* or *help*\nShow this message again`
      );
    }

    if (lowerText === "my watchlist" || lowerText === "watchlist") {
      const list = await getWatchlist(from);
      if (!list.length) {
        return sendText(from, "Your watchlist is empty. Add one with:\n`watch <contract address>`");
      }
      await sendText(from, `📋 Checking your ${list.length} watched token(s)...`);
      for (const addr of list) {
        const result = await getReport(addr);
        if (result.imageUrl) await sendImage(from, result.imageUrl, `${result.symbol || "Token"} logo`);
        await sendText(from, result.text);
        if (result.chartUrl) await sendChartButton(from, result.chartUrl);
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
    if (result.imageUrl) await sendImage(from, result.imageUrl, `${result.symbol || "Token"} logo`);
    await sendText(from, result.text);
    if (result.chartUrl) await sendChartButton(from, result.chartUrl);
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

  const report = buildReport(address, dex, sec);
  const result = { text: report, chartUrl: dex?.url || null, imageUrl: dex?.imageUrl || null, symbol: dex?.baseToken?.symbol || null };

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

app.listen(PORT, () => {
  console.log(`WhatsApp onchain bot listening on port ${PORT}`);
});
