import { exec } from "child_process";
import { NextResponse } from "next/server";
import path from "path";

export async function POST(req: Request) {
  try {
    const { address } = await req.json();
    if (!address) return NextResponse.json({ success: false, error: "Missing address" }, { status: 400 });

    const contractDir = path.resolve(process.cwd(), "../contracts");
    const cmd = `pnpm exec hardhat run scripts/keeper.ts --network baseSepolia`;
    
    return new Promise((resolve) => {
      // Must pass COALITION_ADDRESS to the keeper script
      exec(cmd, { cwd: contractDir, env: { ...process.env, COALITION_ADDRESS: address, STOP_ON_TERMINAL: "true" } }, (error, stdout, stderr) => {
         resolve(NextResponse.json({ success: !error, stdout, stderr }));
      });
    });

  } catch (e) {
    return NextResponse.json({ success: false, error: (e as Error).toString() }, { status: 500 });
  }
}
