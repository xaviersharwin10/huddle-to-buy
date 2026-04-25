import { HuddleAgent } from "./agent.js";
import { AxlClient } from "./axl.js";
import type { Intent } from "./intent.js";
import { SellerAgent } from "./seller.js";

const AXL = process.env.AXL_API ?? "http://127.0.0.1:9002";
const K = Number(process.env.K ?? "3");
const SELLER_PEER_ID = process.env.SELLER_PEER_ID ?? null;
const KNOWN_PEERS = (process.env.KNOWN_PEERS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter((s) => s.length === 64);

const help = `huddle-agent

env:
  AXL_API           AXL local HTTP API (default http://127.0.0.1:9002)
  K                 k-anonymity threshold (default 3)
  SELLER_PEER_ID    seller's full pubkey (64 hex). Coordinator queries this peer for tier price.
  KNOWN_PEERS       comma-separated full pubkeys to broadcast to. Overrides /topology.tree.
                    Use this when Yggdrasil tree convergence is incomplete (hub-spoke topologies).

commands:
  topology
  run [<sku> <max_unit_price> <deadline_hours> <qty>]    submit (optional) + watch as buyer/coordinator
  seller                                                  run as seller — listen for negotiate_request, respond with tier price
`;

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  const axl = new AxlClient(AXL);

  switch (cmd) {
    case "topology": {
      console.log(JSON.stringify(await axl.topology(), null, 2));
      return;
    }

    case "run": {
      const agent = new HuddleAgent(axl, {
        k: K,
        sellerPeerId: SELLER_PEER_ID,
        knownPeers: KNOWN_PEERS.length > 0 ? KNOWN_PEERS : null,
      });
      await agent.init();

      if (args.length >= 4) {
        const intent: Intent = {
          sku: args[0],
          max_unit_price: Number(args[1]),
          deadline_ms: Date.now() + Number(args[2]) * 60 * 60 * 1000,
          qty: Number(args[3]),
        };
        await agent.submit(intent);
      } else if (args.length > 0) {
        process.stderr.write(help);
        process.exit(2);
      }

      console.log(`watching AXL ${AXL} (k=${K})`);
      while (true) {
        const got = await agent.runOnce();
        if (!got) await sleep(300);
      }
    }

    case "seller": {
      const seller = new SellerAgent(axl);
      await seller.init();
      console.log(`seller mode on AXL ${AXL}`);
      while (true) {
        const got = await seller.runOnce();
        if (!got) await sleep(300);
      }
    }

    default:
      process.stderr.write(help);
      process.exit(2);
  }
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
