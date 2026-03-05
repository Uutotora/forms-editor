import { NextRequest, NextResponse } from 'next/server';
import { getQuestion, saveQuestion } from '@/lib/googleSheets';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sheetName: string }> }
) {
  const { sheetName } = await params;
  const decoded = decodeURIComponent(sheetName);
  const question = await getQuestion(decoded);
  if (!question) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ question });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ sheetName: string }> }
) {
  const { sheetName } = await params;
  const decoded = decodeURIComponent(sheetName);
  const current = await req.json();
  await saveQuestion(decoded, current);
  return NextResponse.json({ success: true });
}
