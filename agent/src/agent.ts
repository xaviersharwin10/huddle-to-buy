import { AxlClient } from "./axl.js";
import type {
  CommitEnv,
  Envelope,
  NegotiateReqEnv,
  NegotiateRespEnv,
  RevealReqEnv,
  RevealRespEnv,
} from "./envelope.js";
import { commitment, type Intent, newNonce } from "./intent.js";
import { IntentObserver } from "./observer.js";

export type ClusterState = {
  commitment: string;
  members: Map<string, Intent>;
  coordinator?: string;
  formed: boolean;
  // Day-4 negotiation state:
  negotiateSent?: boolean;
  offer?: { tierUnitPrice: number; validUntilMs: number };
};

type Logger = (s: string) => void;

export type HuddleAgentOptions = {
  k?: number;
  sellerPeerId?: string | null;
  /** Optional override for broadcast peers. If null, falls back to /topology.tree. */
  knownPeers?: string[] | null;
  log?: Logger;
};

export class HuddleAgent {
  private observer: IntentObserver;
  private myCommits = new Map<string, { intent: Intent; nonce: string }>();
  private clusters = new Map<string, ClusterState>();
  private revealsInitiated = new Set<string>();
  myPeerId = "";

  private readonly k: number;
  private readonly sellerPeerId: string | null;
  private readonly knownPeers: string[] | null;
  private readonly log: Logger;

  constructor(private readonly axl: AxlClient, opts: HuddleAgentOptions = {}) {
    this.k = opts.k ?? 3;
    this.sellerPeerId = opts.sellerPeerId ?? null;
    this.knownPeers = opts.knownPeers ?? null;
    this.log = opts.log ?? console.log;
    this.observer = new IntentObserver(24 * 60 * 60 * 1000, this.k);
  }

  private async broadcastPeers(): Promise<string[]> {
    if (this.knownPeers && this.knownPeers.length > 0) {
      return this.knownPeers.filter(
        (p) => p !== this.myPeerId && p !== this.sellerPeerId,
      );
    }
    return (await this.axl.peerIds()).filter((p) => p !== this.sellerPeerId);
  }

  async init(): Promise<void> {
    const t = await this.axl.topology();
    this.myPeerId = t.our_public_key;
    this.log(`agent init: pubkey=${short(this.myPeerId)}${this.sellerPeerId ? `  seller=${short(this.sellerPeerId)}` : ""}`);
  }

  async submit(intent: Intent): Promise<string> {
    const c = commitment(intent);
    const nonce = newNonce();
    this.myCommits.set(c, { intent, nonce });
    this.observer.observe(c, this.myPeerId);
    this.log(`submit ${JSON.stringify(intent)}  c=${short(c)}`);

    const peers = await this.broadcastPeers();
    const env: CommitEnv = { v: 1, kind: "commit", from: this.myPeerId, commitment: c };
    const body = JSON.stringify(env);
    for (const p of peers) {
      try {
        await this.axl.send(p, body);
        this.log(`  -> commit to ${short(p)}`);
      } catch (e) {
        this.log(`  ! commit to ${short(p)} failed: ${(e as Error).message}`);
      }
    }
    return c;
  }

  async runOnce(): Promise<boolean> {
    const m = await this.axl.recv();
    if (!m) return false;

    let env: Envelope;
    try {
      env = JSON.parse(m.body.toString("utf8")) as Envelope;
    } catch {
      this.log(`drop non-json from ${short(m.from)}`);
      return true;
    }
    if (env.v !== 1) return true;
    if (typeof env.from !== "string" || env.from.length !== 64) {
      this.log(`drop bad-from envelope`);
      return true;
    }
    if (!env.from.startsWith(m.from.slice(0, 28))) {
      this.log(`drop spoofed envelope (claim=${short(env.from)} transport=${short(m.from)})`);
      return true;
    }

    switch (env.kind) {
      case "commit":             await this.onCommit(env); break;
      case "reveal_request":     await this.onRevealRequest(env); break;
      case "reveal_response":    await this.onRevealResponse(env); break;
      case "negotiate_request":  this.log(`drop negotiate_request — buyer agent doesn't sell`); break;
      case "negotiate_response": await this.onNegotiateResponse(env); break;
    }
    return true;
  }

  private async onCommit(env: CommitEnv): Promise<void> {
    const r = this.observer.observe(env.commitment, env.from);
    this.log(`recv commit from=${short(env.from)} c=${short(env.commitment)} distinct=${r.count}`);
    if (
      r.thresholdReached &&
      this.myCommits.has(env.commitment) &&
      !this.revealsInitiated.has(env.commitment)
    ) {
      this.revealsInitiated.add(env.commitment);
      await this.initiateReveals(env.commitment);
    }
  }

  private async initiateReveals(c: string): Promise<void> {
    const my = this.myCommits.get(c)!;
    const peers = this.observer.peersFor(c).filter((p) => p !== this.myPeerId);
    this.log(`*** k=${this.k} threshold for ${short(c)} — initiating reveal to ${peers.length} peer(s) ***`);

    const cluster = this.cluster(c);
    cluster.members.set(this.myPeerId, my.intent);

    const env: RevealReqEnv = {
      v: 1, kind: "reveal_request", from: this.myPeerId,
      commitment: c, intent: my.intent, nonce: my.nonce,
    };
    const body = JSON.stringify(env);
    for (const p of peers) {
      try { await this.axl.send(p, body); this.log(`  -> reveal_req to ${short(p)}`); }
      catch (e) { this.log(`  ! reveal_req to ${short(p)} failed: ${(e as Error).message}`); }
    }
    await this.maybeFinalize(c);
  }

  private async onRevealRequest(env: RevealReqEnv): Promise<void> {
    if (commitment(env.intent) !== env.commitment) {
      this.log(`drop reveal_request from ${short(env.from)} — hash mismatch`);
      return;
    }
    this.log(`reveal_req from ${short(env.from)} c=${short(env.commitment)} intent=${JSON.stringify(env.intent)}`);

    const cluster = this.cluster(env.commitment);
    cluster.members.set(env.from, env.intent);

    const my = this.myCommits.get(env.commitment);
    if (my) {
      cluster.members.set(this.myPeerId, my.intent);
      const resp: RevealRespEnv = {
        v: 1, kind: "reveal_response", from: this.myPeerId,
        commitment: env.commitment, intent: my.intent, nonce: my.nonce,
      };
      try { await this.axl.send(env.from, JSON.stringify(resp)); this.log(`  -> reveal_resp to ${short(env.from)}`); }
      catch (e) { this.log(`  ! reveal_resp to ${short(env.from)} failed: ${(e as Error).message}`); }
    }
    await this.maybeFinalize(env.commitment);
  }

  private async onRevealResponse(env: RevealRespEnv): Promise<void> {
    if (commitment(env.intent) !== env.commitment) {
      this.log(`drop reveal_response from ${short(env.from)} — hash mismatch`);
      return;
    }
    this.log(`reveal_resp from ${short(env.from)} c=${short(env.commitment)}`);
    const cluster = this.cluster(env.commitment);
    cluster.members.set(env.from, env.intent);
    await this.maybeFinalize(env.commitment);
  }

  private async maybeFinalize(c: string): Promise<void> {
    const cluster = this.clusters.get(c);
    if (!cluster || cluster.formed) return;
    if (cluster.members.size < this.k) return;

    const sorted = [...cluster.members.keys()].sort();
    cluster.coordinator = sorted[0];
    cluster.formed = true;
    const isMe = cluster.coordinator === this.myPeerId;
    this.log(`*** CLUSTER FORMED c=${short(c)} ${cluster.members.size} members ${isMe ? "(I am coordinator)" : `(coordinator: ${short(cluster.coordinator)})`} ***`);
    for (const p of sorted) {
      const intent = cluster.members.get(p)!;
      this.log(`    member ${short(p)}  qty=${intent.qty}  max=$${intent.max_unit_price}`);
    }

    if (isMe) await this.tryNegotiate(c);
  }

  private async tryNegotiate(c: string): Promise<void> {
    const cluster = this.clusters.get(c)!;
    if (cluster.negotiateSent || !this.sellerPeerId) {
      if (!this.sellerPeerId) this.log(`(no SELLER_PEER_ID set — skipping negotiate)`);
      return;
    }
    cluster.negotiateSent = true;

    // All cluster members agreed on (sku, tier_bucket) per commitment hash. Use the
    // first member's intent as canonical for sku + qty + max_unit_price.
    const sample = [...cluster.members.values()][0];
    const req: NegotiateReqEnv = {
      v: 1,
      kind: "negotiate_request",
      from: this.myPeerId,
      commitment: c,
      sku: sample.sku,
      n_buyers: cluster.members.size,
      unit_qty: sample.qty,
      max_unit_price: sample.max_unit_price,
    };
    this.log(`coordinator: sending negotiate_request to seller ${short(this.sellerPeerId)} (n=${req.n_buyers}, max=$${req.max_unit_price})`);
    try { await this.axl.send(this.sellerPeerId, JSON.stringify(req)); }
    catch (e) { this.log(`  ! negotiate_request failed: ${(e as Error).message}`); }
  }

  private async onNegotiateResponse(env: NegotiateRespEnv): Promise<void> {
    const cluster = this.clusters.get(env.commitment);
    if (!cluster || cluster.coordinator !== this.myPeerId) {
      this.log(`drop negotiate_response — not coordinator for c=${short(env.commitment)}`);
      return;
    }
    if (env.decline_reason) {
      this.log(`*** SELLER DECLINED c=${short(env.commitment)}: ${env.decline_reason} ***`);
      return;
    }
    if (env.tier_unit_price == null || env.valid_until_ms == null) {
      this.log(`drop malformed negotiate_response`);
      return;
    }
    cluster.offer = { tierUnitPrice: env.tier_unit_price, validUntilMs: env.valid_until_ms };

    const indivPrice = [...cluster.members.values()][0].max_unit_price;
    const savedPerBuyer = (indivPrice - env.tier_unit_price) * env.unit_qty;
    const totalSaved = savedPerBuyer * env.n_buyers;
    const expiryS = Math.round((env.valid_until_ms - Date.now()) / 1000);
    this.log(`*** SELLER OFFER c=${short(env.commitment)}: $${env.tier_unit_price}/unit × ${env.unit_qty} × ${env.n_buyers}; saved $${savedPerBuyer.toFixed(2)}/buyer ($${totalSaved.toFixed(2)} total); valid ${expiryS}s ***`);
  }

  private cluster(c: string): ClusterState {
    let cl = this.clusters.get(c);
    if (!cl) {
      cl = { commitment: c, members: new Map(), formed: false };
      this.clusters.set(c, cl);
    }
    return cl;
  }
}

function short(id: string): string {
  return id.slice(0, 12) + "…";
}
