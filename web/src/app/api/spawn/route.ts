import { exec } from "child_process";
import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";

// Track PIDs by port so we can kill them
const pidByPort: Map<number, number> = new Map();

const ENV_MAP: Record<string, string> = {
  buyer1: ".env.buyer1",
  buyer2: ".env.buyer2",
  buyer3: ".env.buyer3",
};

const SELLER_ENV: Record<string, string> = {
  AXL_API: "http://127.0.0.1:9032",
  PRIVATE_KEY: "0xf01962b99237d8525781736ca31397756cd1345e01e09ba529a86a8353275f0c",
  SELLER_PEER_ID: "0d6836e00c80d151a9a6b3157e9d30131bf6611c49e560ee0fdba264679d8238",
};

export async function POST(req: Request) {
  try {
    const { agentId, port, type } = await req.json();
    const agentDir = path.resolve(process.cwd(), "../agent");

    // Kill existing process on that port first
    const oldPid = pidByPort.get(port);
    if (oldPid) {
      try { process.kill(oldPid, "SIGTERM"); } catch {}
      pidByPort.delete(port);
    }
    // Also taskkill by port as fallback
    await new Promise<void>(r => exec(`for /f "tokens=5" %a in ('netstat -aon ^| findstr :${port}') do taskkill /PID %a /F 2>nul`, () => r()));

    // Build env vars string for the PowerShell command
    let envChunk = `$env:PORT='${port}'; `;

    if (type === "seller") {
      for (const [k, v] of Object.entries(SELLER_ENV)) {
        envChunk += `$env:${k}='${v}'; `;
      }
    } else if (ENV_MAP[agentId]) {
      const envPath = path.join(agentDir, ENV_MAP[agentId]);
      if (fs.existsSync(envPath)) {
        fs.readFileSync(envPath, "utf8")
          .split(/\r?\n/)
          .filter(l => /^[^#\s].+=/.test(l))
          .forEach(l => {
            const idx = l.indexOf("=");
            if (idx > -1) {
              const k = l.slice(0, idx).trim();
              const v = l.slice(idx + 1).trim();
              envChunk += `$env:${k}='${v}'; `;
            }
          });
      }
    }

    const tsCmd = type === "seller"
      ? "pnpm exec tsx src/index.ts seller"
      : "pnpm exec tsx src/index.ts run daemon";

    // Full PowerShell one-liner  
    const psCmd = `Set-Location '${agentDir}'; ${envChunk}${tsCmd}`;

    // Spawn a detached powershell window
    const child = exec(
      `powershell.exe -NoExit -Command "${psCmd.replace(/"/g, '\\"')}"`,
      { cwd: agentDir }
    );

    if (child.pid) pidByPort.set(port, child.pid);

    return NextResponse.json({ success: true, pid: child.pid ?? null });
  } catch (e) {
    return NextResponse.json({ success: false, error: (e as Error).toString() }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { port } = await req.json();
    const pid = pidByPort.get(port);
    if (pid) {
      try { process.kill(pid, "SIGTERM"); } catch {}
      pidByPort.delete(port);
    }
    // Kill by port via netstat + taskkill as reliable fallback on Windows
    exec(`for /f "tokens=5" %a in ('netstat -aon ^| findstr :${port}') do taskkill /PID %a /F 2>nul`);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false, error: (e as Error).toString() }, { status: 500 });
  }
}
