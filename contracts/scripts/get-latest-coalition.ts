import { createPublicClient, http, parseAbiItem } from "viem";
import { baseSepolia } from "viem/chains";

const RPC_URL = process.env.RPC_URL ?? "https://sepolia.base.org";
const FACTORY_ADDRESS = "0xF2381Ae6b498B06cA52b665344E1F99C3cf08F57";

async function main() {
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(RPC_URL),
  });

  console.log("Fetching recent CoalitionCreated events...");
  const currentBlock = await publicClient.getBlockNumber();
  const fromBlock = currentBlock - 9900n; // look back ~9900 blocks

  const logs = await publicClient.getLogs({
    address: FACTORY_ADDRESS as `0x${string}`,
    event: parseAbiItem('event CoalitionCreated(address indexed coalition, bytes32 indexed skuHash, address indexed seller, uint256 tierUnitPrice, uint256 unitQty, uint256 requiredBuyers, uint256 validUntil)'),
    fromBlock,
    toBlock: 'latest'
  });

  if (logs.length === 0) {
    console.log("No CoalitionCreated events found recently.");
  } else {
    const latest = logs[logs.length - 1];
    console.log(`LATEST COALITION ADDRESS: ${latest.args.coalition}`);
    console.log(`Transaction Hash: ${latest.transactionHash}`);
    console.log(`Valid Until: ${latest.args.validUntil} (Now: ${Math.floor(Date.now() / 1000)})`);
  }
}

main().catch(console.error);
