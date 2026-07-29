const axios = require("axios");

const GRAPH_VERSION = process.env.GRAPH_API_VERSION || "v20.0";
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const TOKEN = process.env.WHATSAPP_TOKEN;

const client = axios.create({
  baseURL: `https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}`,
  headers: {
    Authorization: `Bearer ${TOKEN}`,
    "Content-Type": "application/json",
  },
  timeout: 10000,
});

async function sendText(to, body) {
  try {
    await client.post("/messages", {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body, preview_url: false },
    });
  } catch (err) {
    console.error("WhatsApp send error:", err.response?.data || err.message);
  }
}
async function sendChartButton(to, chartUrl) {
  try {
    await client.post("/messages", {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "cta_url",
        body: { text: "Tap below to view the live chart 👇" },
        action: {
          name: "cta_url",
          parameters: {
            display_text: "📈 View Live Chart",
            url: chartUrl,
          },
        },
      },
    });
  } catch (err) {
    console.error("Chart button send error:", err.response?.data || err.message);
  }
}
async function sendRefreshButton(to, address) {
  try {
    await client.post("/messages", {
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: "Want the latest numbers?" },
        action: {
          buttons: [
            {
              type: "reply",
              reply: { id: `refresh_${address}`, title: "🔄 Refresh Price" },
            },
          ],
        },
      },
    });
  } catch (err) {
    console.error("Refresh button send error:", err.response?.data || err.message);
  }
}
async function sendImage(to, imageUrl, caption) {
  try {
    await client.post("/messages", {
      messaging_product: "whatsapp",
      to,
      type: "image",
      image: { link: imageUrl, caption: caption || "" },
    });
  } catch (err) {
    console.error("Image send error:", err.response?.data || err.message);
  }
}
async function markAsRead(messageId) {
  try {
    await client.post("/messages", {
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
    });
  } catch (err) {
    console.error("Mark-as-read error:", err.response?.data || err.message);
  }
}



module.exports = { sendText, markAsRead, sendChartButton, sendImage, sendRefreshButton };
