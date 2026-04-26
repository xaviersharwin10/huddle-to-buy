# Day 5 Runbook (Base Sepolia + KeeperHub)

This runbook executes:
1. Full 3-buyer happy path (commit)
2. Drop-out replay (refundAll)
3. KeeperHub registration payload for sponsor-native execution

## 1. Prereqs

- Base Sepolia funded wallets (deployer + 3 buyers + optional dedicated keeper)
- Factory deployed address
- AXL nodes and seller flow working from Day 4

## 2. Environment Files

Create and fill:
- contracts/.env (from contracts/.env.base-sepolia.example)
- agent/.env.buyer1
- agent/.env.buyer2
- agent/.env.buyer3

Use shared values from agent/.env.base-sepolia.example and unique PRIVATE_KEY for each buyer.

For drop-out replay, set one buyer with AUTO_FUND=false.

## 3. Deploy Factory

From contracts:

pnpm exec hardhat run scripts/deploy.ts --network baseSepolia

Save factory address and set FACTORY_ADDRESS in each buyer env.

## 4. Happy Path (3 buyers)

Start AXL nodes and seller as in Day 4, then run 3 buyers with Base Sepolia env loaded.
All three buyers should have AUTO_FUND=true.

Expected chain flow:
- Coordinator deploys Coalition via factory
- Buyers approve USDC and call fund()
- Keeper calls commit()
- Event emitted: CoalitionCommitted

Run local keeper watcher (fallback) with coalition address:

COALITION_ADDRESS=<addr> pnpm exec hardhat run scripts/keeper.ts --network baseSepolia

## 5. Drop-out Replay

Re-run with one buyer set to AUTO_FUND=false (or stop that buyer process before fund).

Expected chain flow:
- Coalition remains Forming/Funded but below threshold
- validUntil expires
- Keeper calls refundAll()
- Event emitted: CoalitionRefunded

## 6. KeeperHub Registration (Sponsor-native)

Generate/send registration payload:

COALITION_ADDRESS=<addr> DRY_RUN=true pnpm exec hardhat run scripts/keeperhub-register.ts --network baseSepolia

When KeeperHub API endpoint + key are available:

COALITION_ADDRESS=<addr> KEEPERHUB_API_URL=<url> KEEPERHUB_API_KEY=<key> DRY_RUN=false pnpm exec hardhat run scripts/keeperhub-register.ts --network baseSepolia

The registration mapping is in:
- contracts/keeperhub/coalition-day5-mapping.json

Mapped events:
- BuyerFunded
- CoalitionCommitted
- CoalitionRefunded

Mapped triggers:
- funded_count == requiredBuyers -> commit()
- now > validUntil -> refundAll()
