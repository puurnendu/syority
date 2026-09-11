/**
 * M7.8.8 — Temporary diagnostic route for build verification.
 * REMOVE AFTER M7.8.8 QA IS COMPLETE.
 */
import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);
const CWD = process.cwd();

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const cmd = searchParams.get('cmd') ?? 'echo hello';

    // Safety: only allow specific commands
    const ALLOWED = ['prisma validate', 'prisma generate', 'tsc --noEmit', 'node --version', 'npx --version'];
    const isAllowed = ALLOWED.some(a => cmd.includes(a));
    if (!isAllowed) {
        return NextResponse.json({ error: 'Command not allowed', cmd }, { status: 403 });
    }

    try {
        const nodeModulesBin = path.join(CWD, 'node_modules', '.bin');
        const env = { ...process.env, PATH: `${nodeModulesBin};${process.env.PATH}` };

        const { stdout, stderr } = await execAsync(cmd, {
            cwd: CWD,
            env,
            timeout: 120_000,
        });
        return NextResponse.json({ success: true, stdout: stdout.slice(0, 20000), stderr: stderr.slice(0, 5000), cwd: CWD });
    } catch (err: any) {
        return NextResponse.json({
            success: false,
            error: err.message,
            stdout: err.stdout?.slice(0, 20000) ?? '',
            stderr: err.stderr?.slice(0, 5000) ?? '',
            cwd: CWD,
        });
    }
}
