export function getWalletAddress(): string {
  return process.env.WALLET_ADDRESS || "0x5bC5EB1DE002F3b514F6F4f90c61fB0d496be7ce";
}

export const DATA_API = "https://data-api.polymarket.com";
// Multiple RPC endpoints for reliability
export const POLYGON_RPCS = [
  "https://polygon-bor-rpc.publicnode.com",
  "https://polygon.llamarpc.com",
  "https://polygon-rpc.com",
];

// USDC.e on Polygon
export const USDC_CONTRACT = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
