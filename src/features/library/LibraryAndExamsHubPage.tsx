import React, { useState } from 'react';
import { FileSpreadsheet, FolderOpen } from 'lucide-react';
import { DocumentsPage } from '@/features/documents/DocumentsPage';
import { ExamsPage } from '@/features/exams/ExamsPage';

export const LibraryAndExamsHubPage: React.FC = () => {
  const [tab, setTab] = useState<'documents' | 'exams'>('documents');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl sm:text-2xl font-bold">Kho Tài liệu & Phòng thi HSK</h1>
        <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 gap-1">
          <button
            type="button"
            onClick={() => setTab('documents')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition ${
              tab === 'documents'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            <span>Nạp & Học Tài liệu</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('exams')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition ${
              tab === 'exams'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Làm đề & Giải đề HSK</span>
          </button>
        </div>
      </div>

      {tab === 'documents' ? <DocumentsPage /> : <ExamsPage />}
    </div>
  );
};
