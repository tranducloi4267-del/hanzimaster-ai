export interface UsageExample {
  hanzi: string;
  pinyin: string;
  literalVi: string;
  translationVi: string;
}

export interface UsageSense {
  partOfSpeech: string;
  register: 'khẩu ngữ' | 'văn viết' | 'trang trọng' | 'trung tính';
  meaningVi: string;
  grammarPattern: string;
  collocations: string[];
  examples: UsageExample[];
}

export interface ConfusableComparison {
  word: string;
  pinyin: string;
  differenceVi: string;
  exampleContrast: string;
}

export interface UsageDetails {
  senses: UsageSense[];
  confusableComparisons?: ConfusableComparison[];
  mnemonicStoryVi?: string;
  aiEnriched?: boolean;
  updatedAt?: number;
}

export interface DictionaryEntry {
  id: string;
  simplified: string;
  traditional?: string;
  pinyin: string;
  pinyinNoTone: string;
  pinyinNumbered?: string;
  hanViet: string;
  meanings: string[];
  hskLevel: number; // 1..6 (0 if outside HSK 2.0)
  hsk3Level?: number; // 1..9
  frequency: number; // lower = more common
  strokesCount: number;
  radical: string;
  confusables?: string[];
  usageDetailsJson?: string;
  searchTokens?: string[];
}

export interface HanziEtymology {
  type?: 'ideographic' | 'pictographic' | 'pictophonetic';
  hint?: string;
  phonetic?: string;
  semantic?: string;
}

export interface HanziGraphic {
  char: string;
  strokes: string[];
  medians: number[][][];
  decomposition: string;
  etymology?: HanziEtymology;
  radical?: string;
  strokesCount: number;
  mnemonicVi?: string;
}

export type VocabStatus = 'new' | 'learning' | 'mastered';
export type VocabSource = 'hsk' | 'lookup' | 'document' | 'lesson' | 'exam' | 'forgotten';

export interface UserVocabItem {
  id: string;
  wordId: string;
  simplified: string;
  status: VocabStatus;
  fsrsCardJson: string;
  wrongCount: number;
  reviewCount: number;
  isLeech: boolean;
  isForgotten?: boolean;
  forgottenAt?: number;
  source: VocabSource;
  customNote?: string;
  addedAt: number;
  nextReviewAt: number;
  updatedAt: number;
}

export interface LessonDialogueLine {
  speaker?: string;
  hanzi: string;
  pinyin: string;
  translationVi: string;
}

export interface LessonGrammarPoint {
  pattern: string;
  explanationVi: string;
  exampleHanzi: string;
  examplePinyin: string;
  exampleVi: string;
}

export interface LessonQuestion {
  id: string;
  questionHanzi: string;
  questionPinyin: string;
  questionVi: string;
  sampleAnswerHanzi: string;
  sampleAnswerPinyin: string;
  sampleAnswerVi: string;
  userAnswer?: string;
  aiFeedback?: {
    score: number;
    isCorrect: boolean;
    commentVi: string;
    naturalVersionHanzi: string;
    naturalVersionPinyin: string;
  };
}

export interface LessonContent {
  summaryVi: string;
  topic: string;
  lines: LessonDialogueLine[];
  grammarPoints: LessonGrammarPoint[];
  questions: LessonQuestion[];
}

export interface LessonItem {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  level: number;
  contentJson: string;
  targetWords: string[];
  sourceType:
    | 'daily-ai'
    | 'daily-offline'
    | 'document'
    | 'curated'
    | 'forgotten-ai'
    | 'forgotten-offline';
  completed: boolean;
  createdAt: number;
}

export interface ExtractedDocWord {
  simplified: string;
  pinyin: string;
  hanViet: string;
  meaningVi: string;
  wordId?: string;
  matchGroup: 'new' | 'learning' | 'mastered';
  selected: boolean;
}

export interface ExtractedDocSentence {
  hanzi: string;
  pinyin: string;
  translationVi: string;
  selected: boolean;
}

export interface DocumentItem {
  id: string;
  title: string;
  fileType: 'image' | 'pdf' | 'docx' | 'txt' | 'paste';
  rawText: string;
  extractedWordsJson: string;
  extractedSentencesJson: string;
  lessonId?: string;
  createdAt: number;
}

export type ExamSectionType = 'listening' | 'reading' | 'writing';

export interface ExamQuestion {
  id: string;
  section: ExamSectionType;
  promptHanzi: string;
  promptPinyin?: string;
  promptVi?: string;
  audioText?: string; // TTS script for listening section
  options?: Array<{ key: string; hanzi: string; pinyin?: string; meaningVi?: string }>;
  correctAnswer: string;
  explanationVi?: string;
}

export interface ExamSection {
  type: ExamSectionType;
  title: string;
  instructionsVi: string;
  questions: ExamQuestion[];
}

export interface ExamAiExplanation {
  questionId: string;
  whyCorrectVi: string;
  distractorTrapVi: string;
  grammarPointVi: string;
  translationVi: string;
  writingScore?: number;
  writingRevisionHanzi?: string;
}

export interface ExamHistoryItem {
  id: string;
  title: string;
  level: number;
  source: 'offline-mock' | 'ai-generated' | 'imported';
  durationMinutes: number;
  sectionsJson: string;
  userAnswersJson: string;
  score: number;
  totalPoints: number;
  aiExplanationsJson?: string;
  createdAt: number;
}

export interface AiCacheItem {
  cacheKey: string;
  type: string;
  model: string;
  payloadJson: string;
  createdAt: number;
}

export interface AudioCacheItem {
  textHash: string;
  text: string;
  voice: string;
  rate: number;
  audioBlob: Blob;
  sizeBytes: number;
  createdAt: number;
  lastAccessedAt: number;
}

export interface StudyLogItem {
  date: string; // YYYY-MM-DD
  wordsLearned: number;
  wordsReviewed: number;
  gamesPlayed: number;
  expEarned: number;
  minutesStudied: number;
}

export interface SettingItem {
  key: string;
  value: unknown;
}

export interface AppSettings {
  theme: 'light' | 'dark';
  hskStandard: 'hsk2' | 'hsk3';
  targetHskLevel: number;
  dailyWordGoal: number;
  geminiApiKey: string;
  geminiPrimaryModel: string;
  geminiLiteModel: string;
  availableModels: string[];
  dailyAiCallDate: string;
  dailyAiCallCount: number;
  ttsVoice: string;
  ttsRate: number;
  ttsProxyUrl: string;
  maxAudioCacheMB: number;
  onboardingCompleted: boolean;
  fullDictLoaded: boolean;
  fullDictCount: number;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: 'light',
  hskStandard: 'hsk2',
  targetHskLevel: 1,
  dailyWordGoal: 10,
  geminiApiKey: '',
  geminiPrimaryModel: 'gemini-3.6-flash',
  geminiLiteModel: 'gemini-3.5-flash-lite',
  availableModels: [
    'gemini-3.5-flash-lite',
    'gemini-3.6-flash',
    'gemini-3.8-flash',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite'
  ],
  dailyAiCallDate: '',
  dailyAiCallCount: 0,
  ttsVoice: 'zh-CN-XiaoxiaoNeural',
  ttsRate: 0.95,
  ttsProxyUrl: '',
  maxAudioCacheMB: 50,
  onboardingCompleted: false,
  fullDictLoaded: false,
  fullDictCount: 0
};

export interface ShadowingTarget {
  hanzi: string;
  pinyin?: string;
  translationVi?: string;
}

export interface ElectronBridgeAPI {
  isElectron: true;
  platform: string;
  synthesizeEdgeTts: (options: {
    text: string;
    voice?: string;
    rate?: number;
  }) => Promise<string>;
  readBundledDataAsset?: (fileName: string) => Promise<Uint8Array | null>;
  isSecureStorageAvailable: () => Promise<boolean>;
  encryptSecret: (plainText: string) => Promise<string>;
  decryptSecret: (payload: string) => Promise<string>;
}

declare global {
  interface Window {
    electronAPI?: ElectronBridgeAPI;
  }
}
