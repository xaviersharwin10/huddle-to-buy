# Huddle — Decentralized Bulk-Buy Coalitions

**Multi-agent protocol for k-anonymous demand aggregation, atomic on-chain settlement, and decentralized seller negotiation.**

Huddle enables strangers to form ad-hoc buying coalitions for digital goods (GPU compute hours, API credits, etc.) and collectively access volume-tier pricing that no individual buyer could reach alone. The protocol runs entirely over Gensyn AXL's encrypted P2P mesh, with atomic settlement on Gensyn L2.

## Architecture

```
Buyer Agent 1 ──┐
Buyer Agent 2 ──┤── AXL Mesh ──→ Seller Agent ──→ Coalition.sol (Gensyn L2)
Buyer Agent 3 ──┘                    │                    │
                                     │                    ▼
                                     ├──→ KeeperHub MCP ──→ commit()
                                     └──→ 0G Storage (buyer profiles)
```

### Protocol Layers

| Layer | Transport | Purpose |
|-------|-----------|---------|
| Commitment broadcast | AXL `/send` (gossip) | k-anonymous demand discovery |
| Reveal handshake | AXL `/a2a/{peer}` (session) | Intent reveal + coordinator election |
| Seller negotiation | AXL `/a2a/{peer}` (session) | Tier price negotiation |
| Keeper settlement | AXL `/mcp/{peer}/keeperhub` (tool) | Atomic commit via MCP |
| Buyer profiles | 0G Storage SDK | ZgFile upload + KV store |
| Preference scoring | 0G Compute | Sealed inference on buyer fitness |

## Quick Start (3-Node Demo)

### Prerequisites

- Node.js ≥ 22
- pnpm
- AXL binary (from [Gensyn](https://docs.gensyn.ai/axl))

### 1. Start AXL Nodes

```bash
# Terminal 1 — Hub node (coordinator)
./axl/upstream/axl --config axl/data/node1.yaml

# Terminal 2 — Peer node 2
./axl/upstream/axl --config axl/data/node2.yaml

# Terminal 3 — Peer node 3
./axl/upstream/axl --config axl/data/node3.yaml

# Terminal 4 — Seller node
./axl/upstream/axl --config axl/data/seller.yaml
```

### 2. Start Agents

```bash
# Install dependencies
cd agent && pnpm install && cd ..

# Terminal 5 — Buyer 1 (coordinator candidate)
cd agent
set -a && source .env.buyer1 && set +a
PORT=3001 pnpm exec tsx src/index.ts run daemon

# Terminal 6 — Buyer 2
PORT=3002 pnpm exec tsx src/index.ts run daemon

# Terminal 7 — Buyer 3
PORT=3003 pnpm exec tsx src/index.ts run daemon

# Terminal 8 — Seller
PORT=3004 pnpm exec tsx src/index.ts seller
```

### 3. Start Web Dashboard

```bash
cd web && pnpm install && pnpm dev
# Open http://localhost:3000
```

### 4. Quick Demo (PowerShell)

```powershell
# Or use the automated boot script:
.\scripts\boot-demo.ps1
```

## AXL Endpoint Usage

| Endpoint | Usage in Huddle | Gensyn Criteria |
|----------|-----------------|-----------------|
| `POST /send` | Commitment broadcast (gossip layer) | Core mesh communication |
| `GET /recv` | Message consumption | Core mesh communication |
| `GET /topology` | Live UI mesh graph | Peer discovery |
| `POST /a2a/{peer}` | Reveal handshake + negotiation sessions | **Bonus: A2A endpoints** |
| `POST /mcp/{peer}/keeperhub` | KeeperHub atomic commit trigger | **Bonus: MCP endpoints** |

## Sponsor Integrations

### Gensyn AXL
- 4 separate AXL nodes running as independent OS processes
- Hub-and-spoke topology with fallback to known-peers
- Encrypted P2P tunnels for all agent communication
- `/a2a` for structured sessions (reveal, negotiate)
- `/mcp` for tool invocation (keeper commit)
- `/topology` for live mesh visualization

### 0G (ERC-7857 + Storage + Compute)
- `@0gfoundation/0g-ts-sdk` for real Storage uploads via `ZgFile` + `Indexer`
- `KvClient` for buyer profile KV lookups
- 0G Compute sealed inference for buyer preference scoring
- ERC-7857 iNFT profile minting on 0G testnet (chainId 16600)
- Contracts deployed via Hardhat `zeroGTestnet` network

### KeeperHub
- MCP server (`keeper-mcp.ts`) exposing `commit_coalition` tool
- Mounted on seller node, invoked via AXL `/mcp` endpoint
- Web API (`/api/keeper`) registers jobs with KeeperHub API
- Fallback chain: KeeperHub API → AXL MCP → direct call

## Smart Contracts

| Contract | Chain | Purpose |
|----------|-------|---------|
| `CoalitionFactory.sol` | Gensyn (685689) | Creates per-deal coalition escrow contracts |
| `Coalition.sol` | Gensyn (685689) | N-party atomic fund + commit/refund |
| `BuyerProfile.sol` | 0G Testnet (16600) | ERC-7857 iNFT for buyer preferences |

### Deploy

```bash
cd contracts
pnpm install

# Deploy to Gensyn
pnpm exec hardhat run scripts/deploy.ts --network gensyn

# Deploy to 0G Testnet
pnpm exec hardhat run scripts/deploy-profile.ts --network zeroGTestnet
```

## Environment Variables

See `.env.buyer1` for a complete example. Key variables:

| Variable | Description |
|----------|-------------|
| `AXL_API` | AXL node HTTP API (e.g. `http://127.0.0.1:9002`) |
| `K` | k-anonymity threshold (default 3) |
| `SELLER_PEER_ID` | Seller's full AXL public key (64 hex) |
| `RPC_URL` | Gensyn RPC (`https://gensyn-mainnet.g.alchemy.com/public`) |
| `CHAIN_ID` | `685689` (Gensyn) |
| `PRIVATE_KEY` | Buyer/coordinator EOA private key |
| `FACTORY_ADDRESS` | Deployed CoalitionFactory address |
| `AUTO_FUND` | Auto-approve and fund on coalition_ready (default true) |

## License

MIT
