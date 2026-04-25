# OpenAgents Hackathon — Two Candidate Ideas

**Event:** ETHGlobal OpenAgents (April 24 – May 6, 2026)
**Target sponsors:** Gensyn AXL ($5k), 0G ($15k), KeeperHub ($5k + $500 feedback bounty)
**Design filters:**
- Normie-facing — a non-crypto user says "I'd use this" in under 10 seconds
- Crypto layer invisible — no wallets, no jargon, no setup
- Universal + daily — the pain hits everyone, every day
- All three sponsors must be structurally load-bearing, not shoehorned

---

## Idea 1 — **Huddle**
### Intent-Matched Bulk Purchase Coalitions

### The Pain
Bulk pricing exists everywhere in B2B and is completely absent in B2C. A Costco pallet price exists because one buyer commits to 48 units. Individually, you and 47 strangers all wanted the same OLED TV this month, each paid retail, each overpaid ~15%. Coordination cost is the only reason the discount doesn't exist — humans can't find each other fast enough, but agents can.

### The Product (user POV)
User tells their agent: *"I want a 65" LG OLED, budget $1,800, willing to wait up to 5 days."* Agent says nothing. Three days later: *"Found 14 other buyers for the same TV, negotiated $1,520 each with Best Buy (including split shipping). Accept?"* One tap, done.

The user never sees wallets, peers, coalitions, or crypto. They see a discount that shouldn't exist.

### Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         USER DEVICE                              │
│  ┌─────────────────────┐      ┌────────────────────────────┐    │
│  │   Huddle App (UI)   │◄────►│   Buyer Agent (local)      │    │
│  │   - Intent input    │      │   - Preferences (iNFT)     │    │
│  │   - Confirm tap     │      │   - Local LLM inference    │    │
│  └─────────────────────┘      └──────────────┬─────────────┘    │
│                                              │                   │
│                              localhost HTTP  │                   │
│                                              ▼                   │
│                               ┌──────────────────────────────┐  │
│                               │   AXL Node (single binary)   │  │
│                               │   - Encryption / routing     │  │
│                               │   - Peer discovery (Yggdra)  │  │
│                               │   - MCP + A2A built in       │  │
│                               └──────────────┬───────────────┘  │
└──────────────────────────────────────────────┼──────────────────┘
                                               │
                              P2P encrypted mesh
                                               │
              ┌────────────────┬───────────────┼───────────────┬────────────────┐
              ▼                ▼               ▼               ▼                ▼
      ┌──────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐
      │ Peer Agent A │  │ Peer B     │  │ Peer C     │  │ Peer D     │  │ ... N peers│
      │ wants same   │  │ wants same │  │ wants same │  │ wants same │  │ wants same │
      └──────┬───────┘  └────────────┘  └────────────┘  └────────────┘  └────────────┘
             │
             │ Coalition formed once k≥10 matching intents
             ▼
      ┌─────────────────────────────────────────────────────────────┐
      │  COORDINATOR AGENT (elected round-robin within coalition)   │
      │  - Negotiates with seller / seller agent                    │
      │  - Returns offer to coalition for approval                  │
      └────────────────────────┬────────────────────────────────────┘
                               │
                               ▼
      ┌─────────────────────────────────────────────────────────────┐
      │           KeeperHub — Atomic Multi-Party Commit             │
      │  - All N buyers commit payment simultaneously               │
      │  - If any buyer drops, tier evaporates, nobody pays         │
      │  - x402 payment leg per buyer                               │
      │  - Seller receives batch order confirmation                 │
      └─────────────────────────────────────────────────────────────┘
```

### Flow Walkthrough

1. **Intent commitment.** Buyer agent posts a hashed intent — `H(product_id || max_price || deadline || nonce)` — over AXL. Neither sellers nor scrapers can see cleartext intent. The raw intent is held locally.
2. **K-anonymity discovery.** Agents gossip intent hashes. When an agent detects ≥k matching hashes (k typically 10 for commodity goods), the cluster reveals intents to each other — and only to each other — over encrypted A2A.
3. **Coordinator election.** Round-robin or stake-weighted — one agent in the cluster is elected to negotiate. The rest observe via A2A messages.
4. **Seller negotiation.** Coordinator contacts the seller (or seller's AXL-running agent) with the coalition size and requested tier price. Seller agrees or counters.
5. **Coalition approval.** Coordinator broadcasts the offer to the cluster. Each buyer's agent presents the offer to its user for one-tap approval. Any tap timeout = drop.
6. **Atomic commit.** KeeperHub orchestrates the simultaneous commit. Either all buyers pay at the tier price and the order ships, or the tier evaporates and nobody pays. x402 handles each buyer's payment leg.
7. **Fulfillment.** Seller ships individually to each buyer's address. Buyer profile iNFT holds the shipping address, sealed so the seller only receives what's strictly needed per order.

### Sponsor Roles (structural, not decorative)

**AXL (Gensyn) — $5k**
Central intent brokers are structurally broken for this use case. They're a honeypot: sellers would price-discriminate against high-intent buyers, scrapers would harvest purchase intents, and the broker would inevitably take a rake. P2P encrypted intent discovery with k-anonymity is the only architecturally safe way to build this. The mesh is not a feature — it's the only viable substrate.

**0G iNFT — up to $7.5k**
The "Buyer Profile" is an ERC-7857 iNFT. It holds preferences (brand affinities, sizing, budget ceilings, urgency patterns) and runs in sealed inference on 0G Compute. The seller never sees your profile — the agent matches intents on your behalf without leaking it. Because it's an iNFT, it's ownable, transferable (e.g., inheritance), and can earn royalties when referring others into the mesh.

**KeeperHub — $5k**
Multi-party atomic commit is the hard problem. One drop-out kills the tier. KeeperHub's execution-reliability guarantees — atomic batch, rollback, retry semantics — make Huddle possible. Without it, you need a centralized escrow taking 3–5% rake, which defeats the whole discount.

---

## Idea 2 — **Reclaim**
### Agent-to-Agent Voucher Marketplace

### The Pain
Americans hold an estimated **$23 billion in unused gift card balances** (CEB, 2023). Add birthday freebies, loyalty points, referral credits, cashback offers, expiring coupons — every adult has hundreds of dollars of "dead money" scattered across 30+ accounts. Existing resale markets (Raise, CardCash, CoinOut) are centralized, take 10–20% rake, and settle in hours or days. Most voucher value just expires unused.

### The Product (user POV)
User is at Target checkout. Agent pops a notification: *"Kate has a $47 Target card. You can have it for $40 — save $7. Accept?"* User taps once.

Behind the scenes: atomic swap, voucher code transferred, $40 paid to Kate, checkout now shows the balance applied. Total time: ~300ms. The user has never heard of Kate, never will, never saw a wallet. They just saved $7 they wouldn't have saved.

### Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                      BUYER'S DEVICE                              │
│  ┌────────────────────┐      ┌─────────────────────────────┐    │
│  │ Reclaim Extension  │◄────►│  Guardian Agent (local)     │    │
│  │ (browser / mobile) │      │  - Voucher inventory (iNFT) │    │
│  │ - Checkout hook    │      │  - Email scan w/ consent    │    │
│  │ - One-tap approve  │      │  - Sealed inference on 0G   │    │
│  └────────────────────┘      └──────────────┬──────────────┘    │
│                                              │                   │
│                                              ▼                   │
│                               ┌──────────────────────────────┐  │
│                               │   AXL Node (single binary)   │  │
│                               └──────────────┬───────────────┘  │
└──────────────────────────────────────────────┼──────────────────┘
                                               │
                              P2P encrypted mesh
                                               │
      ┌────────────────────────────────────────┼─────────────────────────────────┐
      │                                        │                                 │
      │    BROADCAST: "need voucher for Target, max $42"  (k-anonymous)          │
      │                                        │                                 │
      └────────────────────────────────────────┼─────────────────────────────────┘
                                               │
                    ┌──────────────┬───────────┴─────────┬──────────────┐
                    ▼              ▼                     ▼              ▼
           ┌────────────────┐  ┌──────────┐      ┌──────────┐  ┌──────────────┐
           │ Kate's agent   │  │ Pat's    │      │ Jin's    │  │ ... N holders│
           │ $47 card @ $40 │  │ $25 @ 22 │      │ $50 @ 45 │  │              │
           │ + zk-proof     │  │ + zkp    │      │ + zkp    │  │              │
           └────────┬───────┘  └──────────┘      └──────────┘  └──────────────┘
                    │
                    │ Best offer (best $/value ratio) surfaces to buyer
                    ▼
      ┌─────────────────────────────────────────────────────────────┐
      │  BUYER APPROVES  →  KeeperHub Atomic Swap                   │
      │                                                             │
      │  Leg A: voucher code transferred to buyer's sealed vault    │
      │  Leg B: $40 paid to Kate via x402                           │
      │  Leg C: retailer API validation (voucher still valid?)      │
      │                                                             │
      │  All three commit or all three rollback. No fraud window.   │
      └──────────────────────────────┬──────────────────────────────┘
                                     │
                                     ▼
                       ┌──────────────────────────┐
                       │ Extension auto-applies   │
                       │ code at Target checkout  │
                       └──────────────────────────┘
```

### Flow Walkthrough

1. **Voucher inventory ingestion.** With explicit user consent, Guardian agent scans the user's email for voucher codes, gift card balances, loyalty balances, birthday freebies, cashback offers. Inventory is stored inside the user's iNFT — sealed, never leaves the agent.
2. **Checkout-time trigger.** When the user hits checkout on a supported retailer, the extension pings the local Guardian agent with `{retailer, cart_total, expected_discount_budget}`.
3. **Mesh broadcast.** Guardian broadcasts an encrypted request over AXL: *"need voucher for [retailer], min face value $N, max pay $M."* Hashed to preserve k-anonymity — buyers with unusual purchases aren't fingerprinted.
4. **Holder response.** Agents of users holding matching vouchers respond with:
   - A zkproof of voucher validity (proves they hold a code summing to ≥$N at the retailer, without revealing the code)
   - An asking price
5. **Offer ranking.** Buyer agent ranks by $/value ratio, surfaces the best. User taps once to accept.
6. **Atomic swap via KeeperHub.** Three-leg atomic transaction:
   - Leg A: voucher code is transferred to buyer's sealed vault (encrypted, agent-only).
   - Leg B: x402 payment executes from buyer to seller.
   - Leg C: retailer API is called to validate the code is still unredeemed.
   - Failure on any leg → full rollback, no partial state.
7. **Application at checkout.** Extension pulls the code from the sealed vault and auto-fills it at checkout. User sees the discount applied. Done.

### Sponsor Roles (structural, not decorative)

**AXL (Gensyn) — $5k**
Publishing *"I hold a $47 Target card"* to a central marketplace is effectively giving it away — codes get scraped. P2P encrypted discovery with proof-of-possession is structurally required. Additionally, no central platform has economic incentive to run at <2% rake — the mesh does, because its cost is near-zero.

**0G iNFT — up to $7.5k**
The Guardian iNFT holds the user's voucher inventory — spanning 30+ retailers, loyalty balances, account credentials, email scanning permissions. Sealed inference on 0G Compute keeps it fully private. Because it's an ERC-7857 iNFT, it has two unique properties no centralized product can offer:
- **Inheritance.** Voucher and loyalty balances currently die with their owners (billions in unused gift cards are never redeemed). A transferable Guardian iNFT solves this — a real, unsolved problem with moral weight.
- **Royalty streams.** If your Guardian helped train patterns that protect other users (e.g., detecting a scam voucher listing), you earn ongoing royalties on the iNFT.

**KeeperHub — $5k**
Three-leg atomic swap across heterogeneous asset types (voucher code + fiat-stable payment + retailer API validation) is exactly the execution-reliability problem KeeperHub exists to solve. Without atomic guarantees, P2P voucher exchange is impossible — seller provides invalid code, disappears with payment, buyer has no recourse. This is why existing P2P voucher markets have heavy manual escrow and hour-to-day settlement windows. KeeperHub collapses that to ~300ms with correctness guarantees.

---

## Comparative Summary

| Dimension | Huddle | Reclaim |
|---|---|---|
| Universal + daily | yes (everyone buys things) | yes (everyone has unused vouchers) |
| Retailer integration required? | yes — sellers must honor bulk pricing | no — vouchers applied at normal checkout |
| Demo visceral factor | moderate — requires faked seller | high — live $7 saved in 300ms |
| Atomic-commit complexity | N-party payment batch | 3-leg (voucher + payment + validation) |
| 0G iNFT uniqueness | buyer-profile privacy | inheritance + royalty (billions in dead gift cards) |
| Fraud surface | low (real retailer, real product) | medium (voucher codes are bearer tokens; requires zkp or retailer API) |
| Seller-side sales lift for hackathon | heavy | none |

### Author's Recommendation

If forced to pick one for the 10-day hackathon build: **Reclaim.**
- No retailer integration means a working demo in 10 days is realistic.
- The visceral save-$7-in-300ms moment is the kind of WOW-factor the judges ask for.
- The inheritance angle on the 0G iNFT is genuinely unique in a way the buyer-profile iNFT isn't.
- Atomic 3-leg swap across heterogeneous assets is a more compelling KeeperHub demonstration than N-party payment batching.

Huddle is the bigger market long-term, but it's a harder 10-day build and a more crowded competitive corridor.
