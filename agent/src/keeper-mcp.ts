import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { gensyn } from "viem/chains";

// Initialize the MCP server
const server = new Server(
  {
    name: "keeperhub-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define KeeperHub tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "commit_coalition",
        description: "Executes the final settlement payload on a decentralized coalition via KeeperHub, sweeping the escrowed funds to the seller.",
        inputSchema: {
          type: "object",
          properties: {
            coalitionAddress: {
              type: "string",
              description: "The onchain address of the deployed coalition contract.",
            },
          },
          required: ["coalitionAddress"],
        },
      },
    ],
  };
});

// Implement tool logic
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "commit_coalition") {
    const coalitionAddress = String(request.params.arguments?.coalitionAddress);
    
    try {
      const privateKey = (process.env.PRIVATE_KEY || process.env.KEEPER_PRIVATE_KEY) as `0x${string}`;
      if (!privateKey) throw new Error("Missing KEEPER_PRIVATE_KEY");

      const rpcUrl = process.env.RPC_URL || "https://gensyn-mainnet.g.alchemy.com/public";
      
      const account = privateKeyToAccount(privateKey);
      const wallet = createWalletClient({
        account,
        chain: gensyn,
        transport: http(rpcUrl),
      });

      console.error(`[KeeperHub MCP] Sweeping payload for ${coalitionAddress}`);
      
      const txHash = await wallet.writeContract({
        address: coalitionAddress as `0x${string}`,
        abi: [{
          type: "function",
          name: "commit",
          stateMutability: "nonpayable",
          inputs: [],
          outputs: []
        }],
        functionName: "commit",
      });

      return {
        content: [
          {
            type: "text",
            text: `[Success] KeeperHub executed settlement. Transaction Hash: ${txHash}`,
          },
        ],
      };
    } catch (e) {
      return {
        isError: true,
        content: [{ type: "text", text: `Keeper execution failed: ${String(e)}` }],
      };
    }
  }

  throw new Error("Tool not recognized");
});

// Start MCP Server on stdio
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("KeeperHub MCP server active on stdio. Waiting for AI agent triggers...");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
