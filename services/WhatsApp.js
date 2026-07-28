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

module.exports = { sendText, markAsRead };
