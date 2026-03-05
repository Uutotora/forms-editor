'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useStore } from '@/lib/store';
import { TopBar } from '@/components/TopBar';
import { QuestionEditor } from '@/components/QuestionEditor';
import { Loader2 } from 'lucide-react';

export default function QuestionPage() {
  const params = useParams();
  const sheetName = decodeURIComponent(params.sheetName as string);
  const { loadQuestion, currentQuestion } = useStore();

  useEffect(() => {
    loadQuestion(sheetName);
  }, [sheetName, loadQuestion]);

  const isLoading = !currentQuestion || currentQuestion.sheetName !== sheetName;

  return (
    <>
      <TopBar />
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </div>
      ) : (
        <QuestionEditor />
      )}
    </>
  );
}
