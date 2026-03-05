import { NextRequest, NextResponse } from 'next/server';
import { getQuestion, saveQuestion } from '@/lib/parseXlsx';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sheetName: string }> }
) {
  const { sheetName } = await params;
  const decoded = decodeURIComponent(sheetName);
  const question = getQuestion(decoded);
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
  const body = await req.json();
  saveQuestion(decoded, body);
  return NextResponse.json({ success: true });
}
