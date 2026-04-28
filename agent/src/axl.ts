export type TopologyPeer = {
  uri: string;
  up: boolean;
  inbound: boolean;
  public_key: string;
};

export type TopologyTreeNode = {
  public_key: string;
  parent: string;
  sequence: number;
};

export type Topology = {
  our_ipv6: string;
  our_public_key: string;
  peers: TopologyPeer[];
  tree: TopologyTreeNode[];
};

export class AxlClient {
  constructor(public readonly base: string) {}

  async topology(): Promise<Topology> {
    const res = await fetch(`${this.base}/topology`);
    if (!res.ok) throw new Error(`AXL /topology ${res.status}`);
    return (await res.json()) as Topology;
  }

  async send(destPeerId: string, body: string): Promise<number> {
    const res = await fetch(`${this.base}/send`, {
      method: "POST",
      headers: { "X-Destination-Peer-Id": destPeerId },
      body,
    });
    if (!res.ok) {
      throw new Error(`AXL /send ${res.status}: ${await res.text()}`);
    }
    return Number(res.headers.get("x-sent-bytes") ?? 0);
  }

  async recv(): Promise<{ from: string; body: Buffer } | null> {
    const res = await fetch(`${this.base}/recv`);
    if (res.status === 204) return null;
    if (!res.ok) throw new Error(`AXL /recv ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    return { from: res.headers.get("x-from-peer-id") ?? "", body: buf };
  }

  async peerIds(): Promise<string[]> {
    const t = await this.topology();
    return t.tree
      .map((n) => n.public_key)
      .filter((k) => k !== t.our_public_key);
  }

  /**
   * Agent-to-Agent structured session endpoint.
   * Used for reveal handshake + coordinator election (session layer).
   * Gensyn AXL bonus: "novel use of A2A endpoints".
   */
  async a2a(destPeerId: string, payload: object): Promise<any> {
    const res = await fetch(`${this.base}/a2a/${destPeerId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`AXL /a2a ${res.status}: ${await res.text()}`);
    return res.json();
  }

  /**
   * MCP tool invocation via AXL's /mcp/{peer}/{service} endpoint.
   * Used to trigger KeeperHub commit via the MCP server hosted on the seller node.
   * Gensyn AXL bonus: "novel use of MCP endpoints".
   */
  async callMcp(
    peerKey: string,
    service: string,
    toolName: string,
    args: object,
  ): Promise<any> {
    const res = await fetch(`${this.base}/mcp/${peerKey}/${service}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method: "tools/call",
        params: { name: toolName, arguments: args },
      }),
    });
    if (!res.ok) throw new Error(`AXL /mcp ${res.status}: ${await res.text()}`);
    return res.json();
  }
}
