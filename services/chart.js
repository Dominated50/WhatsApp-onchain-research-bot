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
        y: { ticks: { callback: "function(v) { return '$' + v; }" } },
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

module.exports = { buildChartUrl };
