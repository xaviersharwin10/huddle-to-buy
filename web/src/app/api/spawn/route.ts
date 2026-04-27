import { exec } from "child_process";
import { NextResponse } from "next/server";
import path from "path";

export async function POST() {
  return new Promise((resolve) => {
    const scriptPath = path.resolve(process.cwd(), "../scripts/start-ui-agents.ps1");
    // Ensure we tell Windows to pop this out as an independent interactive shell so it bypasses all node stream blocks!
    exec(`start /B powershell.exe -ExecutionPolicy Bypass -File "${scriptPath}"`, (error, stdout, stderr) => {
      resolve(NextResponse.json({ success: true }));
    });
  });
}
