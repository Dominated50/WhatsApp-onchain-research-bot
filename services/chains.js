// Maps Dexscreener's chainId strings to GoPlus Security's numeric chain IDs.
// GoPlus reference: https://docs.gopluslabs.io/reference/chainid
const DEXSCREENER_TO_GOPLUS = {
  ethereum: "1",
  bsc: "56",
  polygon: "137",
  arbitrum: "42161",
  optimism: "10",
  base: "8453",
  avalanche: "43114",
  fantom: "250",
};

// Solana isn't in the EVM chain-id map — GoPlus has a dedicated Solana endpoint.
const isSolanaChain = (dexChainId) => dexChainId === "solana";

// Quick address-shape check, used before we even hit an API.
// This does NOT confirm which chain — Dexscreener tells us that authoritatively.
function detectAddressType(address) {
  if (/^0x[a-fA-F0-9]{40}$/.test(address)) return "evm";
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) return "solana";
  return "unknown";
}

const EXPLORER_HOLDERS_URL = {
  ethereum: (addr) => `https://etherscan.io/token/${addr}#balances`,
  bsc: (addr) => `https://bscscan.com/token/${addr}#balances`,
  polygon: (addr) => `https://polygonscan.com/token/${addr}#balances`,
  arbitrum: (addr) => `https://arbiscan.io/token/${addr}#balances`,
  optimism: (addr) => `https://optimistic.etherscan.io/token/${addr}#balances`,
  base: (addr) => `https://basescan.org/token/${addr}#balances`,
  avalanche: (addr) => `https://snowtrace.io/token/${addr}#balances`,
  fantom: (addr) => `https://ftmscan.com/token/${addr}#balances`,
  solana: (addr) => `https://solscan.io/token/${addr}#holders`,
};

function getHoldersUrl(dexChainId, address) {
  const builder = EXPLORER_HOLDERS_URL[dexChainId];
  return builder ? builder(address) : null;
}

module.exports = { DEXSCREENER_TO_GOPLUS, isSolanaChain, detectAddressType, getHoldersUrl };
