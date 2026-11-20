import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  BookCheck,
  Flame,
  Search,
  Trash2,
  Trophy,
  Volume2
} from 'lucide-react';
import { db } from '@/db/database';
import { setVocabStatus } from '@/services/fsrs/fsrsService';
import { speakChinese } from '@/services/tts/ttsService';
import { useAppStore } from '@/stores/useAppStore';
import type { DictionaryEntry, StudyLogItem, UserVocabItem } from '@/types';
import { getTodayDateString } from '@/utils/pinyin';

interface JoinedVocab {
  vocab: UserVocabItem;
  dict?: DictionaryEntry;
}

function computeStreak(logs: StudyLogItem[]): { current: number; longest: number } {
  const activeDates = new Set(
    logs
      .filter((l) => l.wordsLearned > 0 || l.wordsReviewed > 0 || l.expEarned > 0)
      .map((l) => l.date)
  );
  if (activeDates.size === 0) return { current: 0, longest: 0 };

  const formatOffset = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  let current = 0;
  let offset = activeDates.has(formatOffset(0)) ? 0 : 1;
  while (activeDates.has(formatOffset(offset))) {
    current++;
    offset++;
  }

  const sorted = Array.from(activeDates).sort();
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(`${sorted[i - 1]}T00:00:00`).getTime();
    const cur = new Date(`${sorted[i]}T00:00:00`).getTime();
    if (Math.round((cur - prev) / 86400000) === 1) {
      run++;
      longest = Math.max(longest, run);
    } else {
      run = 1;
    }
  }
  return { current, longest: Math.max(longest, current) };
}

export const StatsPage: React.FC = () => {
  const navigate = useNavigate();
  const { settings, openSplitWord, pushToast } = useAppStore();

  const [logs, setLogs] = useState<StudyLogItem[]>([]);
  const [joinedVocab, setJoinedVocab] = useState<JoinedVocab[]>([]);
  const [hskTotals, setHskTotals] = useState<Record<number, { total: number; mastered: number }>>({});
  const [filterTab, setFilterTab] = useState<'all' | 'learning' | 'mastered' | 'leech'>('all');
  const [vocabQuery, setVocabQuery] = useState('');

  const loadStats = async () => {
    const [allLogs, allVocab, allDict] = await Promise.all([
      db.studyLogs.toArray(),
      db.userVocab.orderBy('updatedAt').reverse().toArray(),
      db.dictionary.toArray()
    ]);

    const dictMap = new Map(allDict.map((d) => [d.id, d]));
    const masteredIds = new Set(
      allVocab.filter((v) => v.status === 'mastered').map((v) => v.wordId)
    );

    const maxLevel = settings.hskStandard === 'hsk3' ? 9 : 6;
    const totals: Record<number, { total: number; mastered: number }> = {};
    for (let lv = 1; lv <= maxLevel; lv++) totals[lv] = { total: 0, mastered: 0 };

    for (const d of allDict) {
      const lv = settings.hskStandard === 'hsk3' ? d.hsk3Level || d.hskLevel : d.hskLevel;
      if (lv >= 1 && lv <= maxLevel) {
        totals[lv].total++;
        if (masteredIds.has(d.id)) totals[lv].mastered++;
      }
    }

    setLogs(allLogs);
    setHskTotals(totals);
    setJoinedVocab(allVocab.map((v) => ({ vocab: v, dict: dictMap.get(v.wordId) })));
  };

  useEffect(() => {
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.hskStandard]);

  const today = getTodayDateString();
  const todayLog = logs.find((l) => l.date === today);
  const todayProgress = Math.min(
    100,
    Math.round(
      (((todayLog?.wordsLearned || 0) + (todayLog?.wordsReviewed || 0)) /
        Math.max(1, settings.dailyWordGoal || 10)) *
        100
    )
  );
  const streak = useMemo(() => computeStreak(logs), [logs]);
  const totalExp = useMemo(() => logs.reduce((s, l) => s + (l.expEarned || 0), 0), [logs]);

  // 365-Day Heatmap cells
  const heatmapDays = useMemo(() => {
    const logByDate = new Map(logs.map((l) => [l.date, l]));
    const cells: Array<{ date: string; score: number }> = [];
    const now = new Date();
    for (let i = 364; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const log = logByDate.get(ds);
      const score = log ? log.expEarned + log.wordsReviewed * 5 : 0;
      cells.push({ date: ds, score });
    }
    return cells;
  }, [logs]);

  const filteredVocab = useMemo(() => {
    const q = vocabQuery.trim().toLowerCase();
    return joinedVocab.filter(({ vocab, dict }) => {
      if (filterTab === 'learning' && vocab.status !== 'learning') return false;
      if (filterTab === 'mastered' && vocab.status !== 'mastered') return false;
      if (filterTab === 'leech' && !vocab.isLeech) return false;
      if (!q) return true;
      return (
        vocab.simplified.includes(q) ||
        (dict?.pinyinNoTone || '').includes(q) ||
        (dict?.meanings.join(' ') || '').toLowerCase().includes(q)
      );
    });
  }, [joinedVocab, filterTab, vocabQuery]);

  const handleToggleMastered = async (item: UserVocabItem) => {
    const next = item.status === 'mastered' ? 'learning' : 'mastered';
    await setVocabStatus(item.wordId, item.simplified, next, item.source);
    await loadStats();
    pushToast(
      next === 'mastered'
        ? `Đã đánh dấu "${item.simplified}" là Đã thuộc!`
        : `Đã đưa "${item.simplified}" lại danh sách Đang học.`,
      'success'
    );
  };

  const handleDeleteVocab = async (item: UserVocabItem) => {
    await db.userVocab.delete(item.id);
    await loadStats();
    pushToast(`Đã xóa "${item.simplified}" khỏi sổ ôn.`, 'info');
  };

  const circleRadius = 38;
  const circleCircumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset = circleCircumference * (1 - todayProgress / 100);

  return (
    <div className="space-y-5">
      <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
        <BarChart3 className="w-6 h-6 text-brand-600" />
        <span>Thống kê Tiến độ & Quản lý Sổ từ</span>
      </h1>

      {/* 4 Thẻ chỉ số tổng quan + Vòng tròn mục tiêu ngày */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex items-center gap-4">
          <div className="relative w-20 h-20 shrink-0">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 96 96">
              <circle
                cx="48"
                cy="48"
                r={circleRadius}
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                className="text-slate-100 dark:text-slate-800"
              />
              <circle
                cx="48"
                cy="48"
                r={circleRadius}
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circleCircumference}
                strokeDashoffset={strokeDashoffset}
                className="text-brand-600 transition-all duration-700"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-extrabold">
              {todayProgress}%
            </span>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400">Mục tiêu hôm nay</div>
            <div className="text-lg font-extrabold">
              {(todayLog?.wordsLearned || 0) + (todayLog?.wordsReviewed || 0)} /{' '}
              {settings.dailyWordGoal}
            </div>
            <div className="text-[11px] text-slate-500">từ học & ôn FSRS</div>
          </div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
            <Flame className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400">Chuỗi ngày (Streak)</div>
            <div className="text-2xl font-extrabold">{streak.current} ngày</div>
            <div className="text-[11px] text-slate-500">Kỷ lục: {streak.longest} ngày</div>
          </div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
            <BookCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400">Sổ từ cá nhân</div>
            <div className="text-2xl font-extrabold">{joinedVocab.length} từ</div>
            <div className="text-[11px] text-slate-500">
              {joinedVocab.filter((j) => j.vocab.status === 'mastered').length} đã thuộc ·{' '}
              {joinedVocab.filter((j) => j.vocab.isLeech).length} tử huyệt
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-400">Tổng kinh nghiệm</div>
            <div className="text-2xl font-extrabold">{totalExp.toLocaleString('vi-VN')}</div>
            <div className="text-[11px] text-slate-500">EXP tích lũy</div>
          </div>
        </div>
      </div>

      {/* Heatmap 365 ngày */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">Bản đồ nhiệt 365 ngày học tập (Heatmap)</h2>
          <div className="flex items-center gap-1 text-[10px] text-slate-400">
            <span>Ít</span>
            <span className="w-2.5 h-2.5 rounded-sm bg-slate-100 dark:bg-slate-800" />
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-200 dark:bg-emerald-900" />
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 dark:bg-emerald-700" />
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-600 dark:bg-emerald-500" />
            <span>Nhiều</span>
          </div>
        </div>

        <div className="overflow-x-auto pb-1">
          <div
            className="grid grid-flow-col grid-rows-7 gap-1 min-w-[700px]"
            aria-label="Heatmap 365 ngày"
          >
            {heatmapDays.map((cell) => {
              const bg =
                cell.score === 0
                  ? 'bg-slate-100 dark:bg-slate-800/80'
                  : cell.score < 30
                    ? 'bg-emerald-200 dark:bg-emerald-900'
                    : cell.score < 80
                      ? 'bg-emerald-400 dark:bg-emerald-700'
                      : 'bg-emerald-600 dark:bg-emerald-500';
              return (
                <div
                  key={cell.date}
                  title={`${cell.date}: ${cell.score} điểm hoạt động`}
                  className={`w-3 h-3 rounded-[3px] ${bg}`}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Biểu đồ % từ đã thuộc theo HSK 1–6 / HSK 3.0 */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm space-y-3">
        <h2 className="text-sm font-bold">
          Tiến độ thuộc từ theo cấp độ ({settings.hskStandard === 'hsk3' ? 'HSK 3.0' : 'HSK 1–6'})
        </h2>
        <div className="space-y-2.5">
          {Object.entries(hskTotals).map(([lv, stat]) => {
            const pct = stat.total > 0 ? Math.round((stat.mastered / stat.total) * 100) : 0;
            return (
              <div key={lv} className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span>HSK {lv}</span>
                  <span className="text-slate-500">
                    {stat.mastered} / {stat.total} từ ({pct}%)
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-500 to-emerald-500 transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quản lý Sổ từ: Đang học / Đã thuộc / Từ tử huyệt */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-sm space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 gap-1 text-xs">
            {[
              { id: 'all', label: `Tất cả (${joinedVocab.length})` },
              {
                id: 'learning',
                label: `Đang học (${joinedVocab.filter((j) => j.vocab.status === 'learning').length})`
              },
              {
                id: 'mastered',
                label: `Đã thuộc (${joinedVocab.filter((j) => j.vocab.status === 'mastered').length})`
              },
              {
                id: 'leech',
                label: `Tử huyệt (${joinedVocab.filter((j) => j.vocab.isLeech).length})`
              }
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setFilterTab(t.id as typeof filterTab)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                  filterTab === t.id
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="relative min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={vocabQuery}
              onChange={(e) => setVocabQuery(e.target.value)}
              placeholder="Lọc trong sổ từ..."
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 pl-8 pr-3 py-1.5 text-xs"
            />
          </div>
        </div>

        {filteredVocab.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-6">
            Chưa có từ nào trong mục này. Chạm vào bất kỳ chữ Hán nào trong app để lưu vào Sổ ôn
            FSRS!
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-96 overflow-y-auto pr-1">
            {filteredVocab.map(({ vocab, dict }) => (
              <div
                key={vocab.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 flex items-center justify-between gap-2"
              >
                <div
                  onClick={() => {
                    if (window.innerWidth >= 1024) openSplitWord(vocab.wordId, 'word');
                    else navigate(`/dictionary?word=${encodeURIComponent(vocab.wordId)}`);
                  }}
                  className="cursor-pointer min-w-0 flex-1"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-hanzi text-xl font-bold">{vocab.simplified}</span>
                    {dict && <span className="text-xs text-brand-600 font-semibold">{dict.pinyin}</span>}
                    {vocab.isLeech && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">
                        <AlertTriangle className="w-3 h-3" /> Sai {vocab.wrongCount} lần
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {dict?.meanings.join('; ') || 'Từ trong sổ ôn'} · Ôn lại:{' '}
                    {new Date(vocab.nextReviewAt).toLocaleDateString('vi-VN')}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => speakChinese(vocab.simplified).catch(() => {})}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
                    title="Nghe"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleMastered(vocab)}
                    className={`px-2 py-1 rounded-lg text-[11px] font-bold ${
                      vocab.status === 'mastered'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {vocab.status === 'mastered' ? 'Đã thuộc' : 'Đang học'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteVocab(vocab)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600"
                    title="Xóa khỏi sổ"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
