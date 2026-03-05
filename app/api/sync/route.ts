import { NextResponse } from 'next/server';
import { invalidateCache, getQuestionList } from '@/lib/googleSheets';

export async function POST() {
  invalidateCache();
  const questions = await getQuestionList();
  return NextResponse.json({ questions });
}
