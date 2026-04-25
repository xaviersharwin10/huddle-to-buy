# Huddle — Architecture & Hackathon Strategy

**Event:** ETHGlobal OpenAgents (Apr 24 – May 6, 2026)
**Submission deadline:** May 3, 12:00 PM EDT
**Build window:** 8 days (Apr 25 → May 3)
**Target prize stack:** Gensyn AXL ($5k) · KeeperHub ($5k + $500 feedback) · 0G ($15k) · Uniswap (TBA)

---

## 1. Executive Summary

**Huddle is a coalition layer for digital volume-tier pricing — agents pool buyer demand to cross thresholds the seller already prices for, settled atomically.**

Most digital products already have volume discounts. AWS Reserved Instances and Savings Plans cut up to 72% off on-demand. Twilio shaves 30–40% per message at high volume. Figma Enterprise lands 20–35% under list. Vast.ai, CoreWeave, and Lambda Labs price reserved GPU at 30–60% off spot. The discount exists. It's just gated behind volume thresholds an individual buyer rarely crosses alone.

A Huddle agent says nothing for a few minutes, then surfaces: *"14 other buyers want H100 hours this week — pooled together you all hit the next reservation tier, ~$32 saved per buyer. Accept?"* One tap, capability tokens issued atomically, each buyer draws down their slice from a single bulk reservation.

**Why this wins:**
- **Demo-able end-to-end.** Three laptops, one tap, real testnet x402 settlement, capability tokens issued atomically, savings shown live.
- **Every sponsor is structurally load-bearing** — none are bolted on. Remove any one and the product breaks.
- **The crypto layer is invisible.** The user's local agent runs the protocol; they see "your agent saved $X this month" — Rocket Money for AI infrastructure.
- **The volume tiers already exist** — the protocol just lets small buyers reach them. No discount-invention required.

---

## 2. Hackathon Track Relevance

ETHGlobal OpenAgents asks: *"What can autonomous agents do that humans + Web2 cannot?"* Three things must be true for an answer to win:

| Track requirement | How Huddle satisfies it |
|---|---|
| **Agents must be autonomous, not assistants** | Buyer agents independently broadcast, match, negotiate, and atomically commit — humans only set the intent and tap once at the end. |
| **Multi-agent collaboration must be load-bearing** | A single agent cannot form a coalition. The product *only exists* when ≥k agents discover one another over the mesh. |
| **Crypto-native primitives must be the only viable substrate** | Centralized matchers honeypot intent and rake the discount. P2P + atomic-commit is the *only* architecture where the discount survives to the user. |

This is the cleanest possible "agents do something humans can't" pitch: **humans cannot find each other fast enough to claim bulk pricing — agents can.**

---

## 3. Detailed Architecture

### 3.1 System Topology

```
                   ┌────────────────────────────────────────────────┐
                   │             USER DEVICE  (per buyer)           │
                   │                                                │
                   │   ┌─────────────────┐   ┌──────────────────┐   │
                   │   │  Huddle Web/    │◄─►│  Buyer Agent     │   │
                   │   │  Mobile UI      │   │  (TypeScript)    │   │
                   │   │  - Intent input │   │  - Plans/decides │   │
                   │   │  - Approve tap  │   │  - Talks MCP/A2A │   │
                   │   └─────────────────┘   └────────┬─────────┘   │
                   │                                  │             │
                   │                       localhost:9002 (HTTP)    │
                   │                                  ▼             │
                   │                   ┌────────────────────────┐   │
                   │                   │  AXL Node (binary)     │   │
                   │                   │  ed25519 peer ID       │   │
                   │                   │  Yggdrasil IPv6 mesh   │   │
                   │                   │  /send /recv /topology │   │
                   │                   │  /mcp/{peer}/{svc}     │   │
                   │                   │  /a2a/{peer}           │   │
                   │                   └───────────┬────────────┘   │
                   └───────────────────────────────┼────────────────┘
                                                   │
                                  P2P encrypted mesh (Yggdrasil)
                                                   │
            ┌──────────────┬───────────────────────┼───────────────────────┬──────────────┐
            ▼              ▼                       ▼                       ▼              ▼
      ┌──────────┐   ┌──────────┐           ┌──────────┐             ┌──────────┐   ┌──────────┐
      │ Peer A   │   │ Peer B   │   ...     │ Peer K   │   ...       │ Peer N-1 │   │ Peer N   │
      │ AXL+Agent│   │ AXL+Agent│           │ AXL+Agent│             │ AXL+Agent│   │ AXL+Agent│
      └────┬─────┘   └──────────┘           └─────┬────┘             └──────────┘   └──────────┘
           │  k-anonymity threshold reached       │
           └────────────► CLUSTER FORMS ◄─────────┘
                                  │
                                  │  Coordinator elected (round-robin, signed)
                                  ▼
                ┌────────────────────────────────────────────────┐
                │       COORDINATOR AGENT (one peer in cluster)  │
                │  - Negotiates with seller's AXL/HTTP endpoint  │
                │  - Returns offer to coalition for ratification │
                └─────────────────────┬──────────────────────────┘
                                      │
                                      ▼
                ┌────────────────────────────────────────────────┐
                │   SETTLEMENT LAYER (onchain — Base Sepolia)    │
                │                                                │
                │   ┌──────────────────────────────────────┐     │
                │   │  Coalition.sol  (state machine)      │     │
                │   │  Forming → Funded → Committed        │     │
                │   │       │           │      │           │     │
                │   │       └─ refund   └─ x402 to seller  │     │
                │   └─────────────────┬────────────────────┘     │
                │                     │                          │
                │                     ▼                          │
                │   ┌──────────────────────────────────────┐     │
                │   │  KeeperHub                           │     │
                │   │  - watches Funded threshold          │     │
                │   │  - atomically triggers Commit        │     │
                │   │  - retries / rolls back on drop-out  │     │
                │   │  - exposed via MCP server tool       │     │
                │   └──────────────────────────────────────┘     │
                │                                                │
                │   ┌──────────────────────────────────────┐     │
                │   │  0G Chain — ERC-7857 Buyer Profile   │     │
                │   │  metadata in 0G Storage              │     │
                │   │  inference sealed in 0G Compute      │     │
                │   └──────────────────────────────────────┘     │
                └────────────────────────────────────────────────┘
```

### 3.2 Component Inventory

| # | Component | Lives where | Purpose | Sponsor surface | Hardest bit |
|---|---|---|---|---|---|
| 1 | **Buyer Agent** | User device (Node/TS) | Owns intent, runs k-anonymity protocol, ratifies offers | — | Distributed coordination correctness |
| 2 | **AXL Node** | User device (binary) | Encrypted P2P transport + peer discovery | **AXL** | Stable peering across NATs |
| 3 | **Intent Commitment Protocol** | Agent ↔ AXL gossip | Hash-broadcast intents without leaking cleartext | **AXL** | Salt/nonce design that prevents replay + correlation |
| 4 | **K-Anonymity Reveal** | A2A messages | Once ≥k matching hashes, cluster reveals to itself only | **AXL** | Race conditions when multiple clusters form |
| 5 | **Coordinator Election** | Cluster A2A | One peer negotiates on behalf of all | **AXL** | Liveness if coordinator drops |
| 6 | **Coalition.sol** | Base Sepolia | State machine: Forming/Funded/Committed/Refunded | **KeeperHub** | Reentrancy + drop-out semantics |
| 7 | **KeeperHub Keeper** | KeeperHub network | Watches threshold, atomically commits or refunds all | **KeeperHub** | Multi-party atomic guarantees |
| 8 | **x402 Payment Leg** | Per-buyer HTTP request | Each buyer's payment to escrow / seller | **KeeperHub** | Settlement timing windows |
| 9 | **Buyer Profile iNFT** | 0G Chain (ERC-7857) | Ownable preferences, sealed inference | **0G** | Sealed compute attestation |
| 10 | **Web UI** | Next.js | Intent input + one-tap approve | — | Polish under time pressure |

### 3.3 Protocol — End-to-End

**Phase 1: Intent commitment (~seconds)**
1. User (or their agent autonomously) submits intent: `{sku, max_unit_price, deadline, qty}` — e.g. `{ "sku": "h100-pcie-hour", "max_unit_price": 1.80, "deadline": "+72h", "qty": 100 }`.
2. Buyer Agent normalizes the SKU to a canonical hash `sku_h = H(sku_normalized)`.
3. Agent posts a commitment `c = H(sku_h ‖ tier_bucket(max_price) ‖ deadline_bucket ‖ nonce)` over AXL gossip via `/send`. The cleartext intent never leaves the device.
4. Tier and deadline are coarsened into buckets so distinct buyers produce identical commitments when their intents intersect.

**Phase 2: K-anonymity discovery (minutes → days)**
5. Each agent maintains a sliding window of observed commitments. When ≥k identical commitments are seen (k=10 for commodity goods, k=5 for niche), the agent enters reveal mode.
6. Reveal handshake over A2A `/a2a/{peer}`: matching peers exchange cleartext intents inside a pairwise-encrypted A2A session. Coalition of N ≤ k peers crystallizes once each side has independently verified ≥k matches.

**Phase 3: Coordinator election & negotiation (seconds)**
7. Cluster runs a deterministic election: lowest peer-ID hash modulo N for round 1; if no progress in 30s, advance to round 2. Electable agents publish a signed `CoordinatorClaim` over A2A.
8. Coordinator opens a session to the seller's AXL endpoint (or HTTPS fallback) and submits `{sku, qty=N, max_unit_price}`. Seller agent returns `{tier_unit_price, valid_until}`.

**Phase 4: Onchain coalition (~minutes)**
9. Coordinator deploys a `Coalition` instance on Base Sepolia (or calls factory) with `{sku_h, tier_unit_price, N, valid_until, sellerAddr}`. State: `Forming`.
10. Coordinator broadcasts the offer to the cluster. Each buyer agent presents the offer to its user; on tap-approve, the agent signs an x402 payment intent and funds the coalition contract.
11. As funds arrive, contract emits `BuyerFunded` events.

**Phase 5: Atomic commit via KeeperHub (~seconds)**
12. KeeperHub watches the contract. When `funded_count == N` before `valid_until`, the keeper calls `commit()` — which transfers the pooled payment to seller and emits `CoalitionCommitted`.
13. If `valid_until` elapses without full funding, keeper calls `refundAll()` — every funded buyer is refunded automatically. **No buyer ever experiences partial state.**

**Phase 6: Fulfillment**
14. Seller receives a single batch payment + N shipping addresses (each released only on commit). Ships individually.

### 3.4 Privacy Properties

- **Sellers see zero pre-coalition signal.** Intent commitments are hashes broadcast peer-to-peer, never reach a seller-controllable surface.
- **Cleartext intents leak only inside an already-formed cluster of size ≥k.** A seller running a Sybil node sees only its own probe responses, not other buyers' intents.
- **Buyer profile iNFT runs sealed.** Even the matching logic uses 0G Compute attested inference — a compromised app server cannot exfiltrate user preferences.
- **Capability tokens issued onchain at `Committed` state**, sealed-encrypted to each buyer's public key. The seller learns the coalition size and pooled payment; never which individual buyer redeems which slice.

---

## 4. Sponsor Checkpoint Coverage

This section maps each sponsor's stated judging criteria onto specific Huddle components, with the artifacts judges will see.

### 4.1 Gensyn AXL — $5,000

**Sponsor's published criteria:**
- AXL must be load-bearing, not decorative
- Must demonstrate communication across separate AXL nodes
- Bonus weight for novel use of MCP and A2A endpoints

**How Huddle hits it:**

| Checkpoint | Huddle artifact |
|---|---|
| Load-bearing | The mesh is the substrate. Centralized matching breaks privacy and economics. Removing AXL deletes the product. |
| Cross-node comms | Demo runs ≥3 separate AXL nodes (3 laptops or 3 VPS) talking over real Yggdrasil routing. Topology visible via `/topology`. |
| MCP usage | KeeperHub keeper exposed as an **MCP tool** (`/mcp/{peer}/keeperhub`) — buyer agents call settlement via MCP, not raw RPC. |
| A2A usage | K-anonymity reveal handshake + coordinator election + offer ratification all happen over `/a2a/{peer}` — a non-trivial, multi-round agent protocol. |
| Novelty | First k-anonymous intent broker on AXL. First multi-party atomic-commit orchestration coordinated over A2A. |

### 4.2 KeeperHub — $5,000 + $500 feedback

**Sponsor's published criteria:**
- Innovative Use OR Integration depth
- Real utility over novelty
- Depth of KeeperHub integration > breadth
- Bonus for x402 / MPP integration and recognized agent frameworks

**How Huddle hits it:**

| Checkpoint | Huddle artifact |
|---|---|
| Real utility | A consumer saves 15% on a TV. There is no clearer "real utility" than money in pocket. |
| Integration depth | KeeperHub is not a single function call — it owns the entire `Forming → Funded → Committed/Refunded` lifecycle, including timeout-driven refunds and atomicity guarantees on N-party payment batches. |
| Innovative use | **N-party atomic commit on a single contract is novel** — most KeeperHub use to date has been DeFi pair operations. Huddle stresses the execution layer with a fundamentally different shape. |
| x402 integration | Each buyer's payment leg flows through x402, with KeeperHub as the orchestrator that decides when N legs are simultaneously valid. |
| Framework | Buyer agents implemented in TypeScript with a thin LangChain-compatible tool surface so KeeperHub MCP server works out of the box. |

### 4.3 0G — up to $15,000

**Sponsor's published criteria (anticipated based on 0G's stated focus):**
- ERC-7857 iNFT issuance
- 0G Storage usage for agent metadata
- 0G Compute used for inference
- Royalty / ownership semantics demonstrated

**How Huddle hits it:**

| Checkpoint | Huddle artifact |
|---|---|
| iNFT minted | Each user mints a Buyer Profile ERC-7857 iNFT on 0G Chain on first run. |
| 0G Storage | Profile metadata (preferences, brand affinities, anonymized purchase history) lives in 0G Storage with content-addressed pointers. |
| 0G Compute | Matching logic — *"is this coalition's offer better than this user's reservation price?"* — runs as sealed inference. The decision is verifiable; the inputs aren't visible to the host. |
| Royalty | Referral royalties: if your iNFT introduced peer X to the mesh and X joins coalitions, you earn a small royalty stream on X's coalition fees. ERC-7857 royalty splits make this trivial. |
| Ownership | Users can transfer or bequeath their Buyer Profile — the agent-as-asset thesis 0G is pushing. |

**Fallback path if 0G Compute is not stable for sealed inference by May 3:** local inference on user device + 0G Storage for metadata + iNFT on 0G Chain. Still hits 3/4 checkpoints.

### 4.4 Uniswap (TBA)

If Uniswap's prize lands as expected (likely v4 hooks or agent-driven swaps), we have a clean integration: the coalition contract accepts USDC contributions via Uniswap if buyers fund in any token. A v4 hook on the coalition pool can also be used to enforce price-tier discovery. **Held in reserve until the prize is announced.**

---

## 5. Why This Wins — Judges' Rubric

ETHGlobal main-prize judging weighs four dimensions. Huddle's positioning on each:

### 5.1 Technicality
- **Distributed systems depth.** K-anonymity broadcast, threshold reveal, coordinator election with liveness, N-party atomic commit, drop-out replay. This is graduate-systems-class material implemented in 8 days.
- **Cross-stack integration.** AXL transport, KeeperHub execution, 0G iNFT — three independent novel stacks woven into one coherent flow. Most submissions will use one sponsor deeply OR three shallowly; we do all three deeply.

### 5.2 Originality
- Bulk-purchase coordination for B2C is a market that *literally cannot exist* without crypto-native rails. Centralized aggregators have tried for 20 years (Groupon, Mob.ly, Massdrop) and all eventually became listing sites because they couldn't solve atomic commit + privacy.
- Concretely novel on AXL+KeeperHub specifically: no shipped product on this stack does multi-party atomic settlement of a P2P-discovered coalition.

### 5.3 Practicality
- The pain is universal and provable. Bulk pricing already exists in B2B. Costco's whole business is monetizing the coordination cost.
- The agent surface is one-tap. Demo a real buyer (the judge) saving real dollars in 30 seconds and they get it instantly.
- TAM: $2.3T US retail × ~5% achievable bulk discount × 10% capture = enormous, but more importantly, *demonstrable on a single SKU in a 3-minute pitch.*

### 5.4 Wow Factor
- **Three laptops, one tap, $840 saved on screen.** Better demo theatre than any DeFi pitch.
- **Drop-out replay:** mid-demo, kill one buyer's laptop. Show the coalition refund automatically. This single moment carries the KeeperHub atomicity story.
- **The "no wallet" magic trick.** The judge never sees a wallet UI in the entire flow. We tell them at the end: *"Every line of that was onchain." Pause.*

---

## 6. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| AXL binary unstable across NATs | Med | High | Pre-bake 3 VPS (Hetzner/DO) as fallback fixed nodes; demo on those if local laptops misbehave. |
| KeeperHub contract semantics ambiguous for N-party | Med | High | Day-1 spike: write a 3-buyer minimal coalition + KeeperHub config; verify with KeeperHub team in Discord. $500 feedback bounty rewards exactly this kind of probing. |
| 0G Compute sealed inference not stable | Med | Med | Fallback to local inference + 0G Storage. iNFT on 0G Chain still mints. |
| x402 sandbox not ready or rate-limited | Low | Med | Mock x402 with deterministic simulator; toggle to real on demo day. |
| Seller-side integration looks mocked | Med | Med | Self-hosted seller reference implementation IS the architectural artifact, not a hack — mirrors real-world tier price cards (AWS RI / vast.ai shape) and accepts x402. Buyer-side protocol is the real product; seller surface is a thin interface future shims plug behind. |
| Capability-token redemption looks mocked | Med | Med | Best mitigation: redeem against a Gensyn testnet compute endpoint (asked sponsor). Fallback: local LLM behind an HTTP API as redemption target — capability token gates real inference at demo time. |
| Eight days is not enough | Med | High | Day-by-day plan (Section 7) with explicit cuts: the demo only needs Days 1–6 to ship; Days 7–8 are polish + recording. |

---

## 7. 8-Day Build Plan

| Day | Date | Deliverable |
|---|---|---|
| 1 | Apr 25 | AXL spike: clone, build, generate ed25519 keys, run 2 nodes, verify `/send`+`/recv` round-trip |
| 2 | Apr 26 | Intent commitment protocol: hash format, gossip, sliding window, basic CLI |
| 3 | Apr 27 | K-anonymity reveal + coordinator election + cluster formation working with 3 nodes |
| 4 | Apr 28 | `Coalition.sol` deployed to Base Sepolia; seller-agent stub negotiates and posts tier |
| 5 | Apr 29 | KeeperHub keeper wired up; atomic commit + refund both demonstrably work |
| 6 | Apr 30 | x402 payment leg integrated; ERC-7857 Buyer Profile minted on 0G; drop-out replay tested |
| 7 | May 1 | Web UI polish; recording; rehearse 3-minute pitch |
| 8 | May 2 | Buffer day for fixes; cut final demo video; submit by Apr 3 noon |

---

## 8. Demo Storyboard (3 minutes)

| 0:00–0:20 | "I need 100 H100-hours this week, max $1.80/hr." Type into Huddle on laptop 1. Hit submit. Agent gives no feedback — just listens. |
| 0:20–0:40 | Cut to laptops 2 and 3 — similar intents typed by demo-buyers (real geo-distributed VPS, real AXL routing). Topology pane shows mesh discovery happening live. |
| 0:40–1:10 | Coalition forms onscreen at k=3 threshold (lowered for demo). Self-hosted seller-agent (own AXL node, tier price card mirroring vast.ai / coreweave shape) returns reservation tier $1.30/hr (vs $1.80 each alone). All three devices show one-tap approve. |
| 1:10–1:40 | Tap. KeeperHub atomic commit fires. Onchain explorer pops up showing `CoalitionCommitted`. Each laptop shows "Saved $50." Capability tokens land in each buyer's local agent — visibly. |
| 1:40–2:10 | **Drop-out replay.** Re-run with laptop 3 disconnected mid-flow. KeeperHub fires `refundAll`. All buyers refunded automatically. *"That's why this needs onchain atomicity — Web2 cannot give you this guarantee."* |
| 2:10–2:40 | Live redemption: laptop 1's agent uses its capability token against the actual compute endpoint (Gensyn testnet compute if available, otherwise a real GPU process behind our reference seller). One inference call runs, output appears. *"Not a stub. The capability token a coalition member receives is interchangeable with what an enterprise customer holds — just earned at coalition pricing."* |
| 2:40–3:00 | Closer: *"Volume discounts on digital have always existed for buyers big enough to hit the threshold. Coalitions on an encrypted mesh let small buyers reach those same tiers — automatically, atomically, anonymously. AWS already prices for this. We just made it reachable."* |

---

## 9. Why Huddle Beats the Field

Most OpenAgents submissions will fall into one of three buckets:
1. **DeFi agent doing yield optimization** — high quality but unsurprising; judges have seen 50.
2. **Single-sponsor deep dives** — wins one prize, doesn't sweep.
3. **Crypto-flavored chatbots** — fail the "what can agents do that humans can't" test.

Huddle is in a fourth bucket: **a consumer pain so universal it requires zero crypto literacy from the user, solved by a multi-agent protocol that genuinely cannot run on Web2.** That positioning targets the main prize, not just the sponsor track.

The cleanest summary of the pitch — for the user to use verbatim — is:

> *"Volume discounts on digital have always existed — for buyers big enough to hit the threshold. Bulk pricing on AWS, on Twilio, on every GPU market. Agents on an encrypted mesh let small buyers cross those thresholds anonymously. KeeperHub makes the settlement atomic. 0G makes the buyer's profile theirs. The user just gets pricing they were never big enough to access alone."*
