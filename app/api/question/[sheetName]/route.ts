import { NextRequest, NextResponse } from 'next/server';
import { getQuestion, saveQuestion } from '@/lib/googleSheets';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sheetName: string }> }
) {
  try {
    const { sheetName } = await params;
    const decoded = decodeURIComponent(sheetName);
    const question = await getQuestion(decoded);
    if (!question) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ question });
  } catch (error) {
    console.error('GET question error:', error);
    return NextResponse.json({ error: 'Internal server error', detail: String(error) }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ sheetName: string }> }
) {
  try {
    const { sheetName } = await params;
    const decoded = decodeURIComponent(sheetName);
    const current = await req.json();
    await saveQuestion(decoded, current);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PUT question error:', error);
    return NextResponse.json({ error: 'Internal server error', detail: String(error) }, { status: 500 });
  }
}
