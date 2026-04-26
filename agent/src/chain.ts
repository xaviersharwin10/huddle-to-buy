import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  http,
  parseUnits,
} from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const FACTORY_ABI = [
  {
    type: "function",
    name: "createCoalition",
    stateMutability: "nonpayable",
    inputs: [
      { name: "skuHash", type: "bytes32" },
      { name: "tierUnitPrice", type: "uint256" },
      { name: "unitQty", type: "uint256" },
      { name: "requiredBuyers", type: "uint256" },
      { name: "validUntil", type: "uint256" },
      { name: "seller", type: "address" },
      { name: "keeper", type: "address" },
      { name: "payToken", type: "address" },
    ],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "event",
    name: "CoalitionCreated",
    inputs: [
      { indexed: true, name: "coalition", type: "address" },
      { indexed: true, name: "skuHash", type: "bytes32" },
      { indexed: true, name: "seller", type: "address" },
      { indexed: false, name: "tierUnitPrice", type: "uint256" },
      { indexed: false, name: "unitQty", type: "uint256" },
      { indexed: false, name: "requiredBuyers", type: "uint256" },
      { indexed: false, name: "validUntil", type: "uint256" },
    ],
    anonymous: false,
  },
] as const;

const COALITION_ABI = [
  {
    type: "function",
    name: "unitPriceTotal",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "fund",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
] as const;

const ERC20_ABI = [
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export type OnchainConfig = {
  rpcUrl: string;
  chainId: number;
  privateKey: `0x${string}`;
  factoryAddress: `0x${string}`;
  keeperAddress: `0x${string}`;
  sellerAddress: `0x${string}`;
  payTokenAddress: `0x${string}`;
  payTokenDecimals: number;
};

export function createOnchainConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): OnchainConfig | null {
  const rpcUrl = env.RPC_URL ?? "";
  const chainId = Number(env.CHAIN_ID ?? "84532");
  const privateKey = env.PRIVATE_KEY ?? "";
  const factoryAddress = env.FACTORY_ADDRESS ?? "";
  const keeperAddress = env.KEEPER_ADDRESS ?? "";
  const sellerAddress = env.SELLER_ADDRESS ?? "";
  const payTokenAddress = env.PAY_TOKEN_ADDRESS ?? "";
  const payTokenDecimals = Number(env.PAY_TOKEN_DECIMALS ?? "6");

  if (
    !rpcUrl ||
    !privateKey ||
    !factoryAddress ||
    !keeperAddress ||
    !sellerAddress ||
    !payTokenAddress
  ) {
    return null;
  }

  return {
    rpcUrl,
    chainId,
    privateKey: normalizeHex(privateKey),
    factoryAddress: normalizeHex(factoryAddress),
    keeperAddress: normalizeHex(keeperAddress),
    sellerAddress: normalizeHex(sellerAddress),
    payTokenAddress: normalizeHex(payTokenAddress),
    payTokenDecimals,
  };
}

export function toTokenUnits(value: number, decimals: number): bigint {
  return parseUnits(value.toString(), decimals);
}

export async function deployCoalition(args: {
  cfg: OnchainConfig;
  skuHash: `0x${string}`;
  tierUnitPrice: bigint;
  unitQty: number;
  requiredBuyers: number;
  validUntilMs: number;
}): Promise<`0x${string}`> {
  const { cfg, skuHash, tierUnitPrice, unitQty, requiredBuyers, validUntilMs } = args;

  const account = privateKeyToAccount(cfg.privateKey);
  const wallet = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(cfg.rpcUrl),
  });
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(cfg.rpcUrl),
  });

  const hash = await wallet.writeContract({
    address: cfg.factoryAddress,
    abi: FACTORY_ABI,
    functionName: "createCoalition",
    args: [
      skuHash,
      tierUnitPrice,
      BigInt(unitQty),
      BigInt(requiredBuyers),
      BigInt(Math.floor(validUntilMs / 1000)),
      cfg.sellerAddress,
      cfg.keeperAddress,
      cfg.payTokenAddress,
    ],
    gas: 1000000n, // 1M gas limit for coalition creation + contract deployment
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  for (const log of receipt.logs) {
    try {
      const parsed = decodeEventLog({ abi: FACTORY_ABI, data: log.data, topics: log.topics });
      if (parsed.eventName === "CoalitionCreated") {
        return parsed.args.coalition;
      }
    } catch {
      // Ignore unrelated logs.
    }
  }

  throw new Error(`missing CoalitionCreated event in tx ${hash}`);
}

export async function fundCoalitionForBuyer(args: {
  cfg: OnchainConfig;
  coalitionAddress: `0x${string}`;
}): Promise<{ approveTx?: `0x${string}`; fundTx: `0x${string}` }> {
  const { cfg, coalitionAddress } = args;
  const account = privateKeyToAccount(cfg.privateKey);

  const wallet = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(cfg.rpcUrl),
  });
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(cfg.rpcUrl),
  });

  // Retry logic for RPC indexing delays
  let slice: bigint | undefined;
  for (let i = 0; i < 5; i++) {
    try {
      slice = await publicClient.readContract({
        address: coalitionAddress,
        abi: COALITION_ABI,
        functionName: "unitPriceTotal",
        args: [],
      });
      break;
    } catch (e) {
      if (i < 4) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
      } else {
        throw e;
      }
    }
  }

  if (!slice) throw new Error("Failed to get unitPriceTotal");

  const currentAllowance = await publicClient.readContract({
    address: cfg.payTokenAddress,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [account.address, coalitionAddress],
  });

  let approveTx: `0x${string}` | undefined;
  if (currentAllowance < slice) {
    approveTx = await wallet.writeContract({
      address: cfg.payTokenAddress,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [coalitionAddress, slice],
      gas: 100000n, // Reasonable gas for ERC20 approve
    });
    await publicClient.waitForTransactionReceipt({ hash: approveTx });
  }

  const fundTx = await wallet.writeContract({
    address: coalitionAddress,
    abi: COALITION_ABI,
    functionName: "fund",
    args: [],
    gas: 500000n, // Reasonable gas for Coalition.fund() call
  });

  await publicClient.waitForTransactionReceipt({ hash: fundTx });
  return { approveTx, fundTx };
}

function normalizeHex(s: string): `0x${string}` {
  const v = s.trim();
  return (v.startsWith("0x") ? v : `0x${v}`) as `0x${string}`;
}
