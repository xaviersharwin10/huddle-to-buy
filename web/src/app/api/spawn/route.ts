import { spawn, exec } from "child_process";
import { NextResponse } from "next/server";
import path from "path";

// Track running processes by port
const runningAgents: Map<number, any> = new Map();

const ENV_MAP: Record<string, string> = {
  buyer1: ".env.buyer1",
  buyer2: ".env.buyer2",
  buyer3: ".env.buyer3",
  seller: ".env.seller",
};

export async function POST(req: Request) {
  try {
    const { agentId, port, type } = await req.json();
    const agentDir = path.resolve(process.cwd(), "../agent");

    // Kill old process on this port if exists
    const old = runningAgents.get(port);
    if (old) { try { old.kill("SIGTERM"); } catch {} runningAgents.delete(port); }

    // Build env
    const env: Record<string, string> = { ...process.env as any, PORT: String(port) };

    // Build command args
    const tsArgs = type === "seller"
      ? ["exec", "tsx", "src/index.ts", "seller"]
      : ["exec", "tsx", "src/index.ts", "run", "daemon"];

    // Load env file vars
    if (ENV_MAP[agentId]) {
      const fs = await import("fs");
      const envPath = path.join(agentDir, ENV_MAP[agentId]);
      if (fs.existsSync(envPath)) {
        fs.readFileSync(envPath, "utf8")
          .split("\n")
          .filter(l => /^[^#].+=/.test(l))
          .forEach(l => {
            const idx = l.indexOf("=");
            if (idx > -1) env[l.slice(0, idx).trim()] = l.slice(idx + 1).trim();
          });
      }
    }

    const proc = spawn("pnpm", tsArgs, {
      cwd: agentDir,
      env,
      detached: false,
      stdio: "pipe",
    });

    runningAgents.set(port, proc);
    const pid = proc.pid;

    proc.on("exit", () => runningAgents.delete(port));

    return NextResponse.json({ success: true, pid });
  } catch (e) {
    return NextResponse.json({ success: false, error: (e as Error).toString() }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { port } = await req.json();
    const proc = runningAgents.get(port);
    if (proc) {
      proc.kill("SIGTERM");
      runningAgents.delete(port);
      return NextResponse.json({ success: true });
    }
    // Also try killing by port via fuser/taskkill as fallback
    exec(`npx kill-port ${port} 2>nul`, () => {});
    return NextResponse.json({ success: true, note: "No tracked process; sent kill-port." });
  } catch (e) {
    return NextResponse.json({ success: false, error: (e as Error).toString() }, { status: 500 });
  }
}
