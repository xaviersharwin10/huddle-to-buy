import { NextResponse } from "next/server";

/**
 * KeeperHub Integration — POST /api/keeper
 * 
 * Instead of running a local keeper.ts script, this route registers a real
 * keeper job with KeeperHub's infrastructure, then lets THEIR network
 * execute the commit() call on the coalition contract.
 * 
 * Flow: UI → POST /api/keeper → KeeperHub /v1/jobs → KeeperHub watches contract → commit()
 */
export async function POST(req: Request) {
  try {
    const { address } = await req.json();
    if (!address) {
      return NextResponse.json({ success: false, error: "Missing coalition address" }, { status: 400 });
    }

    const KEEPERHUB_API = process.env.KEEPERHUB_API_URL ?? "https://api.keeperhub.xyz";
    const KEEPERHUB_KEY = process.env.KEEPERHUB_API_KEY ?? "";
    const CHAIN_ID = process.env.CHAIN_ID ?? "685689"; // Gensyn Mainnet

    console.log(`[KeeperHub] Registering keeper job for coalition: ${address}`);

    // Step 1: Register the keeper job with KeeperHub's API
    const jobPayload = {
      name: `huddle-commit-${address.slice(0, 10)}`,
      chain_id: Number(CHAIN_ID),
      contract_address: address,
      function_signature: "commit()",
      trigger: {
        type: "condition",
        condition: "allFunded()", // KeeperHub watches until all buyers have funded
      },
      max_gas: "500000",
      metadata: {
        project: "huddle-to-buy",
        protocol: "coalition-atomic-commit",
      },
    };

    try {
      const keeperRes = await fetch(`${KEEPERHUB_API}/v1/jobs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(KEEPERHUB_KEY ? { "Authorization": `Bearer ${KEEPERHUB_KEY}` } : {}),
        },
        body: JSON.stringify(jobPayload),
        signal: AbortSignal.timeout(15000),
      });

      if (keeperRes.ok) {
        const jobData = await keeperRes.json();
        console.log(`[KeeperHub] Job registered: ${JSON.stringify(jobData)}`);
        return NextResponse.json({
          success: true,
          source: "keeperhub",
          jobId: jobData.id ?? jobData.job_id ?? "registered",
          message: "KeeperHub job registered. Their network will execute commit() when allFunded() is true.",
        });
      }

      // KeeperHub API returned an error — log and fallback
      const errorText = await keeperRes.text();
      console.log(`[KeeperHub] API error (${keeperRes.status}): ${errorText}`);
      console.log(`[KeeperHub] Falling back to MCP-based keeper invocation...`);
    } catch (fetchErr) {
      console.log(`[KeeperHub] API unreachable: ${(fetchErr as Error).message}`);
      console.log(`[KeeperHub] Falling back to MCP-based keeper invocation...`);
    }

    // Step 2: Fallback — invoke keeper-mcp.ts via AXL /mcp endpoint
    // This uses our MCP server hosted on the seller node
    try {
      const axlBase = process.env.AXL_API ?? "http://127.0.0.1:9002";
      const sellerPeerId = process.env.SELLER_PEER_ID ?? "";

      if (sellerPeerId) {
        const mcpRes = await fetch(`${axlBase}/mcp/${sellerPeerId}/keeperhub`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            method: "tools/call",
            params: {
              name: "commit_coalition",
              arguments: { coalitionAddress: address },
            },
          }),
          signal: AbortSignal.timeout(30000),
        });

        if (mcpRes.ok) {
          const mcpData = await mcpRes.json();
          return NextResponse.json({
            success: true,
            source: "axl-mcp-keeper",
            data: mcpData,
            message: "Keeper executed via AXL /mcp endpoint (MCP server on seller node).",
          });
        }
      }
    } catch (mcpErr) {
      console.log(`[KeeperHub] MCP fallback failed: ${(mcpErr as Error).message}`);
    }

    // Step 3: Last resort — direct local execution
    return NextResponse.json({
      success: false,
      error: "KeeperHub API unreachable and MCP fallback failed. Manual commit() required.",
    }, { status: 503 });

  } catch (e) {
    return NextResponse.json({ success: false, error: (e as Error).toString() }, { status: 500 });
  }
}
