import { redirect } from 'next/navigation';
import { getQuestionList } from '@/lib/parseXlsx';

export const dynamic = 'force-dynamic';

export default function Home() {
  const questions = getQuestionList();
  if (questions.length > 0) {
    redirect(`/questions/${encodeURIComponent(questions[0].sheetName)}`);
  }
  return (
    <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
      Нет вопросов в файле
    </div>
  );
}
