const axios = require("axios");
const FormData = require("form-data");

async function extractTextFromImage(imageBuffer) {
  const form = new FormData();
  form.append("apikey", process.env.OCR_SPACE_API_KEY);
  form.append("language", "eng");
  form.append("OCREngine", "2");
  form.append("file", imageBuffer, { filename: "image.jpg" });

  const response = await axios.post("https://api.ocr.space/parse/image", form, {
    headers: form.getHeaders(),
  });

  const result = response.data;

  if (result.IsErroredOnProcessing) {
    console.error("OCR error:", result.ErrorMessage);
    return null;
  }

  const text = result.ParsedResults?.[0]?.ParsedText || "";
  return text.trim();
}
function extractAddressFromText(text) {
  // Remove line breaks and extra spaces that OCR sometimes inserts
  // when an address wraps across two lines in an image
  const cleaned = text.replace(/\s+/g, "");

  // EVM address: 0x + 40 hex characters
  const evmMatch = cleaned.match(/0x[a-fA-F0-9]{40}/);
  if (evmMatch) return { address: evmMatch[0], type: "evm" };

  // Solana address: base58, roughly 32-44 characters
  const solMatch = cleaned.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
  if (solMatch) return { address: solMatch[0], type: "solana" };

  return null;
}

module.exports = { extractTextFromImage, extractAddressFromText };
