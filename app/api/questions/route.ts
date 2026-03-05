import { NextResponse } from 'next/server';
import { getQuestionList } from '@/lib/googleSheets';

export async function GET() {
  try {
    const questions = await getQuestionList();
    return NextResponse.json({ questions });
  } catch (error) {
    console.error('Failed to load questions:', error);
    return NextResponse.json({ error: 'Failed to load questions', detail: String(error) }, { status: 500 });
  }
}
