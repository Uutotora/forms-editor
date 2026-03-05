import { NextResponse } from 'next/server';
import { invalidateCache, getQuestionList } from '@/lib/parseXlsx';

export async function POST() {
  // Сбрасываем кэш воркбука — при следующем чтении xlsx перечитается с диска
  // В production здесь будет: pull данных из Google Sheets API
  invalidateCache();
  const questions = getQuestionList();
  return NextResponse.json({ questions });
}
