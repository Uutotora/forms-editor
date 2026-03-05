import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({
    status: 'ok',
    message: 'Синхронизация с Google Sheets будет добавлена позже',
  });
}
