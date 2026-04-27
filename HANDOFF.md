# HANDOFF — Huddle Implementation

This is the in-progress hand-off for the Huddle hackathon project.
**Submission deadline: May 3, 2026, 12:00 noon EDT.**
Days 1–4 are done. **Pick up at Day 5.**

---

## What is Huddle?

Coalition layer for digital volume-tier pricing. Agents on an encrypted P2P mesh pool buyer demand to cross thresholds the seller already prices for; settlement is atomic — all buyers commit or none do.

Most digital products (AWS RIs, Twilio, Figma Enterprise, RunPod / CoreWeave / Lambda GPU reservations) already have volume discounts of 30–72%. The discount exists. It's just gated behind volume thresholds an individual buyer rarely crosses alone. Huddle lets small buyers reach those tiers.

**Read these first** (in order):
1. `HUDDLE_ARCHITECTURE.md` — full design, sponsor coverage, 8-day plan, demo storyboard.
2. `HUDDLE_NOVELTY.md` — competitive landscape + judge objection cheat-sheet.
3. `HACKATHON_IDEAS.md` — original Huddle vs Reclaim doc (kept for history).

**Pivot note:** Original framing was physical-retail bulk purchase (TVs from Best Buy etc.). After Gensyn engineer feedback on 2026-04-25 (seller-API gap + last-mile-logistics killer), pivoted to digital goods. Architecture doc has been updated; some sections still reference the old retail framing as residue.

---

## Current status

| Day | Goal | Status |
|---|---|---|
| 1 | AXL spike — 2 nodes, send/recv round-trip | ✅ done |
| 2 | Intent commitment protocol (hash, gossip, sliding-window observer) | ✅ done |
| 3 | K-anonymity reveal + coordinator election (3-node cluster) | ✅ done |
| 4 | `Coalition.sol` + factory + tests; seller stub + negotiate flow | ✅ done locally; **Base Sepolia deploy pending private key** |
| 5 | KeeperHub keeper wired up; atomic commit + refund both demonstrated | 🔶 in progress — refundAll ✅ proven (2026-04-27); commit() happy path: run `scripts/demo-happy-path.ps1` |
| 6 | x402 payment leg + ERC-7857 Buyer Profile iNFT on 0G + drop-out replay | ⬜ |
| 7 | Web UI polish; recording; rehearse 3-min pitch | ⬜ |
| 8 | Buffer + final demo video | ⬜ |

---

## Setup from a fresh clone

### 1. Prerequisites
- Linux or macOS
- Node.js 20+
- pnpm 10+
- Go 1.25.5+ (only for building the AXL binary)
- `openssl`, `jq`, `curl`

### 2. Install Go (if not present)

Linux x86_64:

```bash
mkdir -p ~/.local
cd ~/.local
wget https://go.dev/dl/go1.25.5.linux-amd64.tar.gz
tar xzf go1.25.5.linux-amd64.tar.gz && mv go go-1.25.5
rm go1.25.5.linux-amd64.tar.gz
export PATH="$HOME/.local/go-1.25.5/bin:$PATH"
go version  # should report go1.25.5
```

Add the export to your shell rc file to make permanent.

### 3. Clone + install JS deps

```bash
git clone https://github.com/xaviersharwin10/huddle-to-buy.git
cd huddle-to-buy
pnpm install
```

### 4. Build the AXL node binary

```bash
cd axl
git clone --depth 1 https://github.com/gensyn-ai/axl upstream
cd upstream && make build && cd ..
mkdir -p bin && cp upstream/node bin/node
cd ..
```

The binary will live at `axl/bin/node`. The `run-node.sh` script expects it there.

### 5. Generate per-node ed25519 keys

Each AXL node needs its own private key. Configs are committed; keys are not.

```bash
cd axl
for n in nodeA nodeB nodeC nodeS; do
  openssl genpkey -algorithm ed25519 -out data/$n/private.pem
done
cd ..
```

### 6. Compile contracts + run tests

```bash
cd contracts
pnpm exec hardhat compile
pnpm exec hardhat test   # expect 8 passing
cd ..
```

---

## Reproducing the smoke tests

### Day 1: 2-node send/recv round-trip

Three terminals:

```bash
# T1
axl/scripts/run-node.sh nodeA
# T2
axl/scripts/run-node.sh nodeB
# T3
axl/scripts/smoke.sh
```

Expected on T3: `PASS: round-trip works`.

### Day 3: 3-node k-anonymity cluster (no seller)

```bash
# T1-T3: AXL nodes
axl/scripts/run-node.sh nodeA
axl/scripts/run-node.sh nodeB
axl/scripts/run-node.sh nodeC

# capture pubkeys
A=$(curl -s http://127.0.0.1:9002/topology | jq -r .our_public_key)
B=$(curl -s http://127.0.0.1:9012/topology | jq -r .our_public_key)
C=$(curl -s http://127.0.0.1:9022/topology | jq -r .our_public_key)

# T4-T6: agents (cd into agent/ first)
cd agent
AXL_API=http://127.0.0.1:9002 K=3 KNOWN_PEERS=$A,$B,$C \
  pnpm exec tsx src/index.ts run h100-pcie-hour 1.80 72 100
AXL_API=http://127.0.0.1:9012 K=3 KNOWN_PEERS=$A,$B,$C \
  pnpm exec tsx src/index.ts run h100-pcie-hour 1.80 72 100
AXL_API=http://127.0.0.1:9022 K=3 KNOWN_PEERS=$A,$B,$C \
  pnpm exec tsx src/index.ts run h100-pcie-hour 1.80 72 100
```

Each agent should print `*** CLUSTER FORMED ... 3 members (coordinator: <lex-smallest-pubkey>) ***`.

### Day 4: 4 nodes — 3 buyers + 1 seller, full negotiation

```bash
# T1-T4: AXL nodes
axl/scripts/run-node.sh nodeA
axl/scripts/run-node.sh nodeB
axl/scripts/run-node.sh nodeC
axl/scripts/run-node.sh nodeS

# capture pubkeys
A=$(curl -s http://127.0.0.1:9002/topology | jq -r .our_public_key)
B=$(curl -s http://127.0.0.1:9012/topology | jq -r .our_public_key)
C=$(curl -s http://127.0.0.1:9022/topology | jq -r .our_public_key)
S=$(curl -s http://127.0.0.1:9032/topology | jq -r .our_public_key)

cd agent

# T5: seller
AXL_API=http://127.0.0.1:9032 pnpm exec tsx src/index.ts seller

# T6-T8: buyers
AXL_API=http://127.0.0.1:9002 K=3 SELLER_PEER_ID=$S KNOWN_PEERS=$A,$B,$C,$S \
  pnpm exec tsx src/index.ts run h100-pcie-hour 1.80 72 100
AXL_API=http://127.0.0.1:9012 K=3 SELLER_PEER_ID=$S KNOWN_PEERS=$A,$B,$C,$S \
  pnpm exec tsx src/index.ts run h100-pcie-hour 1.80 72 100
AXL_API=http://127.0.0.1:9022 K=3 SELLER_PEER_ID=$S KNOWN_PEERS=$A,$B,$C,$S \
  pnpm exec tsx src/index.ts run h100-pcie-hour 1.80 72 100
```

The lex-smallest agent (= coordinator) should log:

```
*** SELLER OFFER c=...: $1.5/unit × 100 × 3; saved $30.00/buyer ($90.00 total); valid 300s ***
```

---

## Gotchas banked

1. **AXL `tcp_port` must match across all nodes.** It's a gVisor-internal port (default 7000), not OS-level. Different values across nodes cause `502 Bad Gateway` with `connect tcp [...]:7000: connection was refused` on `/send`. All node-config.json files in `axl/data/*/` use 7000.

2. **Yggdrasil `/topology.tree` doesn't fully converge in hub-spoke setups.** Each leaf only sees its ancestors; full mesh awareness never arrives. Use the `KNOWN_PEERS` env override (comma-separated full pubkeys) for deterministic peer discovery during demos. For production, add a gossip-based discovery layer (relay envelope kind).

3. **AXL `/recv` `X-From-Peer-Id` is the first 14 bytes of the sender's pubkey + `ff` padding.** It is *not* the full 64-hex pubkey. Each app envelope carries `from: <full pubkey>`; the agent validates `env.from.startsWith(xFromPeerId.slice(0, 28))` to bind transport-authenticated identity to the application-layer claim.

4. **Commitment hash is deterministic** — `H(skuHash || tier_bucket || deadline_bucket)`, no nonce. Required for k-anonymity (identical-intent buyers must produce identical hashes). Tradeoff: passive observer can pre-image the SKU space. Acceptable v1 threat model. Production needs PSI.

5. **Coordinator election: lex-smallest `peer_id` of cluster members.** Deterministic; every agent independently arrives at the same coordinator. No round-robin needed for hackathon scope.

6. **All 4 nodes peer to nodeA** (the listener). nodeA's `node-config.json` has `Listen: ["tls://127.0.0.1:9001"]`; the others have `Peers: ["tls://127.0.0.1:9001"]`.

---

## Day 5+ — what's next

### Day 5: KeeperHub keeper integration
1. Get a Base Sepolia private key (need ~0.01 test ETH from [the Coinbase faucet](https://www.coinbase.com/faucets/base-sepolia-faucet)). Set `PRIVATE_KEY=...` in `contracts/.env`.
2. Deploy the factory: `cd contracts && pnpm exec hardhat run scripts/deploy.ts --network baseSepolia`. Note the address.
3. Coordinator extension: after seller offer, deploy a `Coalition` instance via factory with `{skuHash, tierUnitPrice, unitQty, nBuyers, validUntil, sellerAddr, keeperHubAddr, usdcAddr}` and broadcast its address to the cluster.
4. Register the contract with KeeperHub (their docs / Discord). Map events `BuyerFunded`, `CoalitionCommitted`, `CoalitionRefunded`. Trigger condition: when `funded_count == requiredBuyers` → call `commit()`. On `validUntil` expiry → call `refundAll()`.
5. Buyer agents: approve USDC (Base Sepolia testnet USDC: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`) and call `fund()` once the cluster offer is approved.
6. **Drop-out replay test**: kill one buyer's agent before they fund → `validUntil` elapses → KeeperHub fires `refundAll()` → all funded buyers refunded automatically.

### Day 6
- x402 payment leg integration (Coinbase CDP, native to Base) — wraps the buyer's `fund()` call.
- ERC-7857 Buyer Profile iNFT deployed to **0G testnet** (chain 16602, RPC `https://evmrpc-testnet.0g.ai`). Holds preferences (workload type, budget ceiling, brand affinities). Sealed inference on 0G Compute for matching logic.
- Drop-out replay tested end-to-end on testnet.

### Day 7
- Next.js web UI in `web/` (intent input form, one-tap approve, savings display, AXL topology pane).
- Record demo video. Rehearse 3-minute pitch from architecture doc §8.

### Day 8
- Buffer day for fixes.
- Cut final submission video, submit by **May 3 noon EDT**.

---

## Key files

### Agent
- `agent/src/agent.ts` — `HuddleAgent` class (commit, reveal, cluster, coordinator election, negotiate).
- `agent/src/seller.ts` — `SellerAgent` (tier price card + negotiate handler).
- `agent/src/envelope.ts` — wire-format type union.
- `agent/src/observer.ts` — sliding-window per-peer commitment observer (Sybil-resistant).
- `agent/src/intent.ts` — `Intent` type + commitment hash + tier/deadline bucketing.
- `agent/src/axl.ts` — typed AXL HTTP client.
- `agent/src/index.ts` — CLI entrypoint (`topology` / `run` / `seller`).

### Contracts
- `contracts/contracts/Coalition.sol` — N-party atomic-commit escrow (state machine: `Forming → Funded → Committed/Refunded`).
- `contracts/contracts/CoalitionFactory.sol` — coordinator deploys instances via this.
- `contracts/contracts/MockUSDC.sol` — local test stand-in (6 decimals, mintable).
- `contracts/test/Coalition.test.ts` — 8 state-machine tests.
- `contracts/scripts/deploy.ts` — Base Sepolia factory deployment.

### AXL
- `axl/data/{nodeA,nodeB,nodeC,nodeS}/node-config.json` — per-node configs.
- `axl/scripts/run-node.sh` — launcher.
- `axl/scripts/smoke.sh` — Day 1 round-trip test.
- `axl/upstream/` — gitignored; clone Gensyn's AXL there before building.
- `axl/bin/node` — gitignored; built binary lives here.

---

### Scripts (PowerShell — run from repo root)

- `scripts/demo-happy-path.ps1` — Full P0 happy path: kills stale procs, restarts nodes, launches seller+3 buyers in separate windows, prompts for coalition address, runs keeper → `commit()`.
- `scripts/demo-dropout-replay.ps1` — P1 drop-out replay: same as above but buyer3 has `AUTO_FUND=false`; keeper fires `refundAll()` after `validUntil`.
- `scripts/start-nodes.ps1` — Just starts the 4 AXL nodes (helper, called by the demo scripts).
- `contracts/scripts/fund-buyer.ts` — One-shot fund script: `PRIVATE_KEY=... COALITION_ADDRESS=... pnpm exec tsx contracts/scripts/fund-buyer.ts` from `agent/` dir.

---

## Useful commands

```bash
# typecheck agent
cd agent && pnpm typecheck

# run hardhat tests
cd contracts && pnpm exec hardhat test

# print AXL topology of a node
AXL_API=http://127.0.0.1:9002 pnpm exec tsx agent/src/index.ts topology

# stop everything
pkill -f "axl/bin/node"
pkill -f "tsx src/index.ts"
```

---

## Sponsor stack

- **AXL** ($5k Gensyn) — ✅ wired (encrypted P2P transport, A2A reveal/negotiate). Needs more polish at demo time but core flow works.
- **KeeperHub** ($5k + $500) — ⬜ Day 5. Atomic commit / refund of N-party coalition contract.
- **0G** ($15k) — ⬜ Day 6. ERC-7857 Buyer Profile iNFT.
- **Uniswap** (TBA) — held in reserve; revisit when their prize lands.

---

## Architectural decisions to *not* relitigate

- **Multi-chain by design**: `Coalition.sol` on Base Sepolia (KeeperHub home + x402 native). Buyer Profile iNFT on 0G testnet. AXL off-chain. Each sponsor gets the layer they specifically care about.
- **Seller side is a self-hosted reference implementation, not a real seller**: no major cloud accepts x402 in 8 days; the buyer-side protocol is the real artifact, the seller surface is a thin interface future shims plug behind. Tier price card mirrors vast.ai / coreweave shape so a real shim is small.
- **Seller-peer-id is supplied via env (`SELLER_PEER_ID`)**: out-of-band discovery. Production would announce sellers via a directory or discovery envelope.
- **Hash without nonce, deterministic bucketing**: see gotcha #4. Don't change without thinking through k-anonymity vs replay-protection.
