import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'up',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
}
