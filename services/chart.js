const axios = require("axios");

async function buildChartUrl(priceData, tokenName) {
  if (!priceData || !priceData.length) return null;

  const labels = priceData.map((p) => {
    const d = new Date(p.time);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  });
  const prices = priceData.map((p) => p.price);

  const chartConfig = {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: tokenName || "Price",
          data: prices,
          fill: true,
          borderColor: "#22c55e",
          backgroundColor: "rgba(34, 197, 94, 0.15)",
          pointRadius: 0,
          borderWidth: 2,
          tension: 0.3,
        },
      ],
    },
    options: {
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: `${tokenName || "Token"} - Last 30 Days`,
        },
      },
      scales: {
        x: { ticks: { maxTicksLimit: 8 } },
      },
    },
  };

  try {
    const response = await axios.post("https://quickchart.io/chart/create", {
      chart: chartConfig,
      width: 800,
      height: 400,
      backgroundColor: "white",
    });
    return response.data?.url || null;
  } catch (err) {
    console.error("QuickChart create error:", err.message);
    return null;
  }
}
async function buildCandlestickChartUrl(ohlcData, tokenName, mode = "price") {
  if (!ohlcData || !ohlcData.length) return null;

  const label = mode === "mcap" ? "Market Cap" : "Price";

  const dataset = {
    label: tokenName || label,
    data: ohlcData.map((c) => ({
      x: c.time,
      o: c.open,
      h: c.high,
      l: c.low,
      c: c.close,
    })),
    color: {
      up: "#22c55e",
      down: "#ef4444",
      unchanged: "#999999",
    },
  };

  const chartConfig = {
    type: "candlestick",
    data: { datasets: [dataset] },
    options: {
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: `ChainScope — ${tokenName || "Token"} ${label} — Last 30 Days`,
        },
      },
      scales: {
        x: { type: "time", time: { unit: "day" }, ticks: { maxTicksLimit: 8 } },
      },
    },
  };

  try {
    const response = await axios.post("https://quickchart.io/chart/create", {
      chart: chartConfig,
      width: 800,
      height: 400,
      backgroundColor: "white",
      version: "3",
    });
    return response.data?.url || null;
  } catch (err) {
    console.error("QuickChart candlestick create error:", err.message);
    return null;
  }
}

module.exports = { buildChartUrl, buildCandlestickChartUrl };
