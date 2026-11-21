import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Award,
  BookOpen,
  Eye,
  Flag,
  Flame,
  Gamepad2,
  Hammer,
  Layers,
  PenTool,
  Puzzle,
  Swords,
  Zap
} from 'lucide-react';
import { db } from '@/db/database';
import { useAppStore } from '@/stores/useAppStore';
import { useDisplayStore } from '@/stores/useDisplayStore';
import type { DictionaryEntry, LessonItem } from '@/types';
import { DisplayControlBar } from '@/components/common/DisplayControlBar';
import { loadArcadeDeck, type ArcadeSentence, type ArcadeSourceType } from './arcadeUtils';
import { SpeedRecallGame } from './SpeedRecallGame';
import { ContextClozeGame } from './ContextClozeGame';
import { SentenceBuilderGame } from './SentenceBuilderGame';
import { HanziCraftAndToneGame } from './HanziCraftAndToneGame';
import { ConfusableHunterGame } from './ConfusableHunterGame';
import { BlindStrokeGame } from './BlindStrokeGame';
import { LessonBossRaidGame } from './LessonBossRaidGame';

type GameId =
  | 'speed-recall'
  | 'context-cloze'
  | 'sentence-builder'
  | 'craft-tone'
  | 'confusable-hunter'
  | 'blind-stroke'
  | 'boss-raid';

const GAMES_META: Array<{
  id: GameId;
  num: number;
  method: string;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}> = [
  {
    id: 'speed-recall',
    num: 1,
    method: 'Active Recall',
    title: 'Đấu trường 4 chiều & Lật thẻ',
    desc: 'Đảo 4 chiều nhìn/nghe/nghĩa/đục lỗ, có giải thích rõ, làm lại & quay lại câu trước.',
    icon: Zap,
    color: 'from-rose-500 to-orange-500'
  },
  {
    id: 'context-cloze',
    num: 2,
    method: 'Cloze Deletion',
    title: 'Lấp đầy Bài khóa',
    desc: 'Điền từ vào câu thật bằng Trắc nghiệm, Gõ chữ hoặc Vẽ tay trực tiếp.',
    icon: Layers,
    color: 'from-indigo-500 to-sky-500'
  },
  {
    id: 'sentence-builder',
    num: 3,
    method: 'Chunking',
    title: 'Ghép cầu Ngữ pháp',
    desc: 'Sắp xếp cụm từ xáo trộn đúng trật tự ngữ pháp tiếng Trung, có lùi bước & giải thích.',
    icon: Puzzle,
    color: 'from-emerald-500 to-teal-500'
  },
  {
    id: 'craft-tone',
    num: 4,
    method: 'Dual Coding & Mnemonics',
    title: 'Lò rèn Bộ thủ & Chém Thanh điệu',
    desc: 'Ghép bộ thủ thành chữ (女+子→好, chạm ô để sửa) & vuốt Canvas chém 4 thanh điệu.',
    icon: Hammer,
    color: 'from-amber-500 to-yellow-500'
  },
  {
    id: 'confusable-hunter',
    num: 5,
    method: 'Interleaving',
    title: 'Truy tìm Giả mạo',
    desc: 'Phân biệt chữ hình cận tự (买/卖, 己/已, 大/太) và đồng âm dễ nhầm.',
    icon: Eye,
    color: 'from-purple-500 to-fuchsia-500'
  },
  {
    id: 'blind-stroke',
    num: 6,
    method: 'Muscle Memory',
    title: 'Luyện viết mù từng nét',
    desc: 'Ẩn hoàn toàn chữ mẫu — nghe phát âm & viết thẳng từng nét lên bảng.',
    icon: PenTool,
    color: 'from-cyan-500 to-blue-600'
  },
  {
    id: 'boss-raid',
    num: 7,
    method: 'Output Effect',
    title: 'Đấu Trùm Bài Học (4 Pha)',
    desc: 'Nghe nhanh → Điền khuyết → Viết mù → Đặt câu kết liễu Boss HP!',
    icon: Swords,
    color: 'from-red-600 to-rose-700'
  }
];

export const ArcadeHubPage: React.FC = () => {
  const {
    settings,
    updateSettings,
    activeArcadeLessonId,
    setActiveArcadeLessonId,
    activeArcadeCustomWordIds,
    setActiveArcadeCustomWordIds
  } = useAppStore();
  const { applyPracticeDefaults, hardcoreMode } = useDisplayStore();

  const [source, setSource] = useState<ArcadeSourceType>(
    activeArcadeCustomWordIds?.length
      ? 'custom'
      : activeArcadeLessonId
        ? 'lesson'
        : 'hsk'
  );
  const [hskLevel, setHskLevel] = useState<number>(settings.targetHskLevel || 1);
  const [forgottenLevelFilter, setForgottenLevelFilter] = useState<number>(0); // 0 = tất cả
  const [customWordIds, setCustomWordIds] = useState<string[]>(activeArcadeCustomWordIds || []);
  const [lessons, setLessons] = useState<LessonItem[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState<string>(
    activeArcadeLessonId || ''
  );
  const [dueCount, setDueCount] = useState(0);
  const [forgottenCount, setForgottenCount] = useState(0);

  const [activeGame, setActiveGame] = useState<GameId | null>(null);
  const [deckWords, setDeckWords] = useState<DictionaryEntry[]>([]);
  const [deckSentences, setDeckSentences] = useState<ArcadeSentence[]>([]);
  const [sourceLabel, setSourceLabel] = useState('');
  const [summary, setSummary] = useState<{ correct: number; total: number; exp: number } | null>(
    null
  );

  // Đồng bộ cấp độ từ Cài đặt / Hôm nay
  useEffect(() => {
    setHskLevel(settings.targetHskLevel || 1);
  }, [settings.targetHskLevel]);

  useEffect(() => {
    (async () => {
      const allLessons = await db.lessons.orderBy('createdAt').reverse().limit(35).toArray();
      setLessons(allLessons);
      if (activeArcadeCustomWordIds && activeArcadeCustomWordIds.length > 0) {
        setCustomWordIds(activeArcadeCustomWordIds);
        setSource('custom');
        setActiveArcadeCustomWordIds(null);
      } else if (activeArcadeLessonId) {
        setSource('lesson');
        setSelectedLessonId(activeArcadeLessonId);
        setActiveArcadeLessonId(null);
      } else if (!selectedLessonId && allLessons.length > 0) {
        setSelectedLessonId(allLessons[0].id);
      }
      const now = Date.now();
      setDueCount(await db.userVocab.where('nextReviewAt').belowOrEqual(now).count());
      setForgottenCount(
        await db.userVocab.filter((v) => Boolean(v.isForgotten || v.isLeech)).count()
      );
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGame]);

  const startGame = async (gameId: GameId) => {
    applyPracticeDefaults();
    const deck = await loadArcadeDeck({
      source,
      hskLevel: source === 'forgotten' ? forgottenLevelFilter : hskLevel,
      hskStandard: settings.hskStandard,
      lessonId: selectedLessonId,
      customWordIds,
      limit: 20
    });
    setDeckWords(deck.words);
    setDeckSentences(deck.sentences);
    setSourceLabel(deck.sourceLabel);
    setSummary(null);
    setActiveGame(gameId);
  };

  if (activeGame) {
    const meta = GAMES_META.find((g) => g.id === activeGame)!;
    return (
      <div className="space-y-4 max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveGame(null);
              setSummary(null);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quay lại Memory Arcade</span>
          </button>
          <span className="text-xs font-semibold text-slate-500 truncate">
            {meta.title} · {sourceLabel}
          </span>
        </div>

        <DisplayControlBar showHardcoreToggle compact />

        {summary ? (
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 text-center shadow-sm space-y-4">
            <Award className="w-14 h-14 mx-auto text-amber-500" />
            <h2 className="text-2xl font-bold">Hoàn thành {meta.title}!</h2>
            <div className="flex items-center justify-center gap-4 text-sm">
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/50 px-4 py-2.5">
                <div className="text-xs text-slate-500">Chính xác</div>
                <div className="text-xl font-bold text-emerald-600">
                  {summary.correct}/{summary.total}
                </div>
              </div>
              <div className="rounded-xl bg-amber-50 dark:bg-amber-950/50 px-4 py-2.5">
                <div className="text-xs text-slate-500">Kinh nghiệm nhận được</div>
                <div className="text-xl font-bold text-amber-600">
                  +{summary.exp} EXP {hardcoreMode ? '(Hardcore x2)' : ''}
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Toàn bộ tiến độ ôn tập đã được tự động cập nhật vào lịch FSRS &amp; mục Từ quên.
            </p>
            <div className="flex justify-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => startGame(activeGame)}
                className="rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 text-sm font-bold"
              >
                Chơi ván mới
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveGame(null);
                  setSummary(null);
                }}
                className="rounded-xl border border-slate-200 dark:border-slate-700 px-5 py-2.5 text-sm font-semibold"
              >
                Chọn trò chơi khác
              </button>
            </div>
          </div>
        ) : (
          <>
            {activeGame === 'speed-recall' && (
              <SpeedRecallGame words={deckWords} onFinish={setSummary} />
            )}
            {activeGame === 'context-cloze' && (
              <ContextClozeGame
                words={deckWords}
                sentences={deckSentences}
                onFinish={setSummary}
              />
            )}
            {activeGame === 'sentence-builder' && (
              <SentenceBuilderGame sentences={deckSentences} onFinish={setSummary} />
            )}
            {activeGame === 'craft-tone' && (
              <HanziCraftAndToneGame words={deckWords} onFinish={setSummary} />
            )}
            {activeGame === 'confusable-hunter' && (
              <ConfusableHunterGame onFinish={setSummary} />
            )}
            {activeGame === 'blind-stroke' && (
              <BlindStrokeGame words={deckWords} onFinish={setSummary} />
            )}
            {activeGame === 'boss-raid' && (
              <LessonBossRaidGame
                words={deckWords}
                sentences={deckSentences}
                sourceLabel={sourceLabel}
                onFinish={setSummary}
              />
            )}
          </>
        )}
      </div>
    );
  }

  const maxHsk = settings.hskStandard === 'hsk3' ? 9 : 6;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Gamepad2 className="w-6 h-6 text-brand-600" />
            <span>Memory Arcade — 7 Phương pháp Ghi nhớ</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Làm xong có giải thích chi tiết từng câu, sửa khi bấm nhầm, lùi câu trước &amp; đồng bộ theo cấp HSK.
          </p>
        </div>
      </div>

      <DisplayControlBar showHardcoreToggle />

      {/* Bộ chọn nguồn dữ liệu chơi */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-3">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
          1. Chọn nguồn từ vựng để ôn chơi
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {[
            {
              id: 'hsk',
              label: `Theo cấp ${settings.hskStandard === 'hsk3' ? 'HSK 3.0' : 'HSK 1–6'}`,
              icon: BookOpen
            },
            {
              id: 'forgotten',
              label: `Từ quên theo mức độ (${forgottenCount})`,
              icon: Flag
            },
            {
              id: 'lesson',
              label: `Bài khóa đã mở (${lessons.length})`,
              icon: Layers
            },
            {
              id: 'fsrs-due',
              label: `Đến hạn FSRS (${dueCount})`,
              icon: Flame
            }
          ].map((opt) => {
            const Icon = opt.icon;
            const active = source === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSource(opt.id as ArcadeSourceType)}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold transition text-left ${
                  active
                    ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 hover:border-brand-400'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{opt.label}</span>
              </button>
            );
          })}
        </div>

        {source === 'custom' && customWordIds.length > 0 && (
          <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-3 flex items-center justify-between gap-2 text-xs text-amber-800 dark:text-amber-200">
            <span>
              Đang chọn bộ <strong>{customWordIds.length} từ quên</strong> chuyển từ màn hình Hôm nay. Bấm chọn 1 trò chơi bên dưới để luyện ngay!
            </span>
            <button
              type="button"
              onClick={() => {
                setCustomWordIds([]);
                setSource('hsk');
              }}
              className="font-bold underline shrink-0"
            >
              Đổi nguồn khác
            </button>
          </div>
        )}

        {source === 'hsk' && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {Array.from({ length: maxHsk }, (_, i) => i + 1).map((lv) => (
              <button
                key={lv}
                type="button"
                onClick={() => {
                  setHskLevel(lv);
                  updateSettings({ targetHskLevel: lv });
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold border transition ${
                  hskLevel === lv
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent'
                    : 'border-slate-200 dark:border-slate-700 hover:border-brand-400'
                }`}
              >
                HSK {lv}
              </button>
            ))}
          </div>
        )}

        {source === 'forgotten' && (
          <div className="space-y-2 pt-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setForgottenLevelFilter(0)}
                className={`px-3 py-1 rounded-lg text-xs font-bold border transition ${
                  forgottenLevelFilter === 0
                    ? 'bg-amber-500 text-white border-amber-500'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                Tất cả cấp độ
              </button>
              {Array.from({ length: maxHsk }, (_, i) => i + 1).map((lv) => (
                <button
                  key={lv}
                  type="button"
                  onClick={() => setForgottenLevelFilter(lv)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold border transition ${
                    forgottenLevelFilter === lv
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  HSK {lv}
                </button>
              ))}
            </div>
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Ôn tập tập trung các từ bạn đánh dấu <strong>"+ Từ quên"</strong> hoặc từng trả lời sai theo đúng cấp độ HSK.
            </p>
          </div>
        )}

        {source === 'lesson' && (
          <select
            value={selectedLessonId}
            onChange={(e) => setSelectedLessonId(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-medium"
          >
            {lessons.length === 0 ? (
              <option value="">Chưa có bài khóa — hãy mở 1 bài khóa ở mục Hôm nay</option>
            ) : (
              lessons.map((l) => (
                <option key={l.id} value={l.id}>
                  [HSK {l.level}] {l.title} ({l.targetWords.length} từ)
                </option>
              ))
            )}
          </select>
        )}
      </div>

      {/* Lưới 7 Trò chơi */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
        {GAMES_META.map((game) => {
          const Icon = game.icon;
          return (
            <button
              key={game.id}
              type="button"
              onClick={() => startGame(game.id)}
              className="group text-left rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-brand-400 dark:hover:border-brand-600 p-4 shadow-sm hover:shadow-md transition flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div
                  className={`w-11 h-11 rounded-xl bg-gradient-to-br ${game.color} text-white flex items-center justify-center shadow-sm group-hover:scale-105 transition`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  #{game.num} · {game.method}
                </span>
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 transition">
                  {game.title}
                </h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {game.desc}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
