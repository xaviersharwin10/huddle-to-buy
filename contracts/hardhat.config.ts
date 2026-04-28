import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
import { HardhatUserConfig } from "hardhat/config";

dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY ?? "";
const GENSYN_RPC = process.env.BASE_SEPOLIA_RPC ?? "https://gensyn-mainnet.g.alchemy.com/public";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "cancun"
    },
  },
  networks: {
    // Primary deployment target — Gensyn Mainnet (sponsor chain)
    gensyn: {
      url: GENSYN_RPC,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 685689,
    },
    // 0G Testnet — for BuyerProfile.sol iNFT deployment
    zeroGTestnet: {
      url: "https://evmrpc-testnet.0g.ai",
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 16600,
    },
    // Legacy — kept for reference only
    baseSepolia: {
      url: "https://base-sepolia-rpc.publicnode.com",
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
      chainId: 84532,
    },
  },
};

export default config;
