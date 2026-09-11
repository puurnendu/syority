import { NextRequest, NextResponse } from 'next/server';
import { guardApi, orgScope } from '@/lib/apiGuard';
import { prisma } from '@/lib/prisma';
import { createReadStream, statSync } from 'fs';
import { join } from 'path';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ updateId: string }> }
) {
  const { session, error } = await guardApi('workpacks.view');
  if (error) return error;
  const { orgId } = orgScope(session!);
  const { updateId } = await context.params;

  const update = await prisma.whatsapp_updates.findFirst({
    where: { id: updateId, organization_id: orgId },
    select: { audio_storage_path: true },
  });

  if (!update?.audio_storage_path) {
    return NextResponse.json({ error: 'Audio not found' }, { status: 404 });
  }

  const fullPath = update.audio_storage_path.startsWith('/')
    ? update.audio_storage_path
    : join(process.cwd(), update.audio_storage_path);

  let stat: ReturnType<typeof statSync>;
  try {
    stat = statSync(fullPath);
  } catch {
    return NextResponse.json(
      { error: 'Audio file not found on disk' },
      { status: 404 }
    );
  }

  const rangeHeader = req.headers.get('range');
  const fileSize = stat.size;

  if (rangeHeader) {
    const parts = rangeHeader.replace('bytes=', '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunk = end - start + 1;
    const stream = createReadStream(fullPath, { start, end });
    return new Response(stream as unknown as ReadableStream<Uint8Array>, {
      status: 206,
      headers: {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(chunk),
        'Content-Type': 'audio/ogg',
      },
    });
  }

  const stream = createReadStream(fullPath);
  return new Response(stream as unknown as ReadableStream<Uint8Array>, {
    status: 200,
    headers: {
      'Content-Type': 'audio/ogg',
      'Content-Length': String(fileSize),
      'Accept-Ranges': 'bytes',
    },
  });
}
