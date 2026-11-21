import type { Part } from '@google/genai';
import { z } from 'zod';
import { callGeminiStructured } from './geminiClient';
import type {
  DictionaryEntry,
  ExamAiExplanation,
  ExamQuestion,
  ExamSection,
  HanziGraphic,
  LessonContent,
  UsageDetails
} from '@/types';
import { saveWordUsageDetails } from '@/services/dictionary/dictionaryService';
import { db } from '@/db/database';

const SYSTEM_VI_TEACHER =
  'Bạn là chuyên gia giảng dạy tiếng Trung Giản thể (HSK 1-6 & HSK 3.0) cho người Việt. ' +
  'Luôn trả về JSON thuần hợp lệ đúng schema yêu cầu, không kèm markdown, giải thích tiếng Việt tự nhiên, dễ hiểu, chính xác thanh điệu Pinyin.';

// 1. Phân tích toàn bộ trường hợp dùng từ (4 tầng) & lưu vĩnh viễn vào IndexedDB
const UsageDetailsSchema = z.object({
  senses: z
    .array(
      z.object({
        partOfSpeech: z.string(),
        register: z.enum(['khẩu ngữ', 'văn viết', 'trang trọng', 'trung tính']).catch('trung tính'),
        meaningVi: z.string(),
        grammarPattern: z.string(),
        collocations: z.array(z.string()).default([]),
        examples: z
          .array(
            z.object({
              hanzi: z.string(),
              pinyin: z.string(),
              literalVi: z.string(),
              translationVi: z.string()
            })
          )
          .min(1)
      })
    )
    .min(1),
  confusableComparisons: z
    .array(
      z.object({
        word: z.string(),
        pinyin: z.string(),
        differenceVi: z.string(),
        exampleContrast: z.string()
      })
    )
    .optional(),
  mnemonicStoryVi: z.string().optional()
});

export async function analyzeWordUsageAI(entry: DictionaryEntry): Promise<UsageDetails> {
  const prompt = `Phân tích TOÀN BỘ các trường hợp sử dụng thực tế của từ tiếng Trung Giản thể "${entry.simplified}" (${entry.pinyin}, Hán-Việt: ${entry.hanViet || 'chưa rõ'}).
Trả về JSON theo cấu trúc:
{
  "senses": [
    {
      "partOfSpeech": "Danh từ / Động từ / Phó từ / ...",
      "register": "khẩu ngữ" | "văn viết" | "trang trọng" | "trung tính",
      "meaningVi": "nghĩa tiếng Việt chính xác",
      "grammarPattern": "cấu trúc ngữ pháp đi kèm, ví dụ: A + từ + B",
      "collocations": ["cụm từ cố định 1", "cụm từ 2", "cụm từ 3"],
      "examples": [
        {
          "hanzi": "câu ví dụ tiếng Trung Giản thể tự nhiên",
          "pinyin": "phiên âm đầy đủ dấu thanh",
          "literalVi": "dịch sát từng từ để người Việt hiểu trật tự ngữ pháp",
          "translationVi": "dịch tiếng Việt tự nhiên"
        }
      ]
    }
  ],
  "confusableComparisons": [
    {
      "word": "từ dễ nhầm / đồng nghĩa / cận tự",
      "pinyin": "pinyin",
      "differenceVi": "điểm khác nhau cốt lõi bằng tiếng Việt",
      "exampleContrast": "ví dụ đối chiếu ngắn"
    }
  ],
  "mnemonicStoryVi": "câu chuyện vui chiết tự ghi nhớ mặt chữ bằng tiếng Việt"
}
Mỗi trường hợp dùng cần 2 ví dụ thực tế rõ ràng. Liệt kê đủ các nét nghĩa quan trọng nhất trong HSK.`;

  const res = await callGeminiStructured({
    taskType: 'word-usage',
    cacheKey: `${entry.simplified}|${entry.pinyin}`,
    tier: 'primary',
    systemInstruction: SYSTEM_VI_TEACHER,
    prompt,
    schema: UsageDetailsSchema
  });

  await saveWordUsageDetails(entry.id, res.data);
  return { ...res.data, aiEnriched: true, updatedAt: Date.now() };
}

// 2. Chiết tự & câu chuyện ghi nhớ Mnemonics
const MnemonicSchema = z.object({
  mnemonicStoryVi: z.string(),
  componentsBreakdown: z
    .array(
      z.object({
        part: z.string(),
        meaningVi: z.string()
      })
    )
    .default([])
});

export async function generateMnemonicAI(
  char: string,
  graphic?: HanziGraphic | null
): Promise<z.infer<typeof MnemonicSchema>> {
  const prompt = `Tạo câu chuyện chiết tự ngắn gọn, dễ nhớ, sinh động bằng tiếng Việt cho chữ Hán Giản thể "${char}" (cấu trúc: ${graphic?.decomposition || 'tự phân tích'}, bộ thủ: ${graphic?.radical || 'tự xác định'}).
Trả về JSON:
{
  "mnemonicStoryVi": "câu chuyện vui 2-3 câu giúp nhớ ngay mặt chữ và nghĩa",
  "componentsBreakdown": [{ "part": "bộ phận", "meaningVi": "ý nghĩa tiếng Việt" }]
}`;

  const res = await callGeminiStructured({
    taskType: 'mnemonic',
    cacheKey: char,
    tier: 'lite',
    systemInstruction: SYSTEM_VI_TEACHER,
    prompt,
    schema: MnemonicSchema
  });

  if (graphic) {
    await db.hanziGraphics.update(char, { mnemonicVi: res.data.mnemonicStoryVi });
  }
  return res.data;
}

// 3. Nhận diện chữ viết tay siêu chuẩn bằng Gemini Vision
const VisionHandwritingSchema = z.object({
  candidates: z.array(z.string()).min(1)
});

export async function recognizeHandwritingVisionAI(canvasDataUrl: string): Promise<string[]> {
  const base64 = canvasDataUrl.replace(/^data:image\/\w+;base64,/, '');
  const prompt =
    'Ảnh đính kèm là 1 chữ Hán Giản thể người dùng viết tay trên bảng vẽ. ' +
    'Hãy nhận diện chính xác và trả về tối đa 8 chữ Hán Giản thể khả dĩ nhất xếp từ chính xác nhất đến gần giống nhất dưới dạng JSON: { "candidates": ["字1", "字2", ...] }.';

  const res = await callGeminiStructured({
    taskType: 'handwriting-vision',
    bypassCache: true,
    tier: 'lite',
    prompt,
    parts: [{ inlineData: { mimeType: 'image/png', data: base64 } }],
    schema: VisionHandwritingSchema,
    temperature: 0.1
  });
  return res.data.candidates;
}

// 4. Tạo Bài khóa Hàng ngày theo danh sách từ mục tiêu
const DailyLessonSchema = z.object({
  title: z.string(),
  topic: z.string(),
  summaryVi: z.string(),
  lines: z
    .array(
      z.object({
        speaker: z.string().optional(),
        hanzi: z.string(),
        pinyin: z.string(),
        translationVi: z.string()
      })
    )
    .min(3),
  grammarPoints: z
    .array(
      z.object({
        pattern: z.string(),
        explanationVi: z.string(),
        exampleHanzi: z.string(),
        examplePinyin: z.string(),
        exampleVi: z.string()
      })
    )
    .default([]),
  questions: z
    .array(
      z.object({
        id: z.string(),
        questionHanzi: z.string(),
        questionPinyin: z.string(),
        questionVi: z.string(),
        sampleAnswerHanzi: z.string(),
        sampleAnswerPinyin: z.string(),
        sampleAnswerVi: z.string()
      })
    )
    .min(3)
});

export async function generateDailyLessonAI(
  date: string,
  level: number,
  targetWords: string[],
  customTopic?: string,
  bypassCache = false
): Promise<{ title: string; content: LessonContent }> {
  const topicText = customTopic?.trim()
    ? `Chủ đề yêu cầu: ${customTopic.trim()}.`
    : 'Chọn 1 chủ đề đời sống thực tế hấp dẫn (du lịch, ẩm thực, công việc, mua sắm, học tập, công nghệ...).';

  const prompt = `Viết 1 bài hội thoại / bài khóa tiếng Trung Giản thể hoàn toàn mới trình độ HSK ${level} cho ngày ${date}.
${topicText}
BẮT BUỘC lồng ghép tự nhiên các từ mục tiêu sau vào bài khóa: ${targetWords.join('、')}.
Trả về JSON:
{
  "title": "Tiêu đề ngắn hấp dẫn (tiếng Trung + tiếng Việt)",
  "topic": "Tên chủ đề tiếng Việt",
  "summaryVi": "Tóm tắt tình huống 1-2 câu bằng tiếng Việt",
  "lines": [
    { "speaker": "Tên nhân vật (tùy chọn)", "hanzi": "Câu tiếng Trung", "pinyin": "Pinyin có dấu", "translationVi": "Dịch tiếng Việt tự nhiên" }
  ],
  "grammarPoints": [
    { "pattern": "Cấu trúc ngữ pháp nổi bật trong bài", "explanationVi": "Giải thích ngắn gọn", "exampleHanzi": "...", "examplePinyin": "...", "exampleVi": "..." }
  ],
  "questions": [
    {
      "id": "q1",
      "questionHanzi": "Câu hỏi đọc hiểu bám sát nội dung bài",
      "questionPinyin": "...",
      "questionVi": "Nghĩa câu hỏi tiếng Việt",
      "sampleAnswerHanzi": "Câu trả lời mẫu tiếng Trung",
      "sampleAnswerPinyin": "...",
      "sampleAnswerVi": "Nghĩa tiếng Việt"
    }
  ]
}
Tạo 6-8 câu hội thoại/đoạn văn, 2 điểm ngữ pháp trọng tâm và 3-4 câu hỏi đọc hiểu.`;

  const res = await callGeminiStructured({
    taskType: 'daily-lesson',
    cacheKey: `${date}|${level}|${customTopic || 'auto'}|${targetWords.slice(0, 12).join(',')}`,
    bypassCache,
    tier: 'primary',
    systemInstruction: SYSTEM_VI_TEACHER,
    prompt,
    schema: DailyLessonSchema,
    temperature: 0.65
  });

  return {
    title: res.data.title,
    content: {
      summaryVi: res.data.summaryVi,
      topic: res.data.topic,
      lines: res.data.lines,
      grammarPoints: res.data.grammarPoints,
      questions: res.data.questions
    }
  };
}

// 5. Chấm câu trả lời đọc hiểu theo bài khóa
const ReadingGradeSchema = z.object({
  score: z.number().min(0).max(10),
  isCorrect: z.boolean(),
  commentVi: z.string(),
  naturalVersionHanzi: z.string(),
  naturalVersionPinyin: z.string()
});

export async function gradeReadingAnswerAI(
  passageHanzi: string,
  questionHanzi: string,
  userAnswer: string
): Promise<z.infer<typeof ReadingGradeSchema>> {
  const prompt = `Bài khóa:\n${passageHanzi}\n\nCâu hỏi: ${questionHanzi}\nCâu trả lời của học viên: ${userAnswer}\n
Hãy chấm xem học viên trả lời đúng ý bài khóa và đúng ngữ pháp tiếng Trung chưa. Trả về JSON:
{
  "score": 0-10,
  "isCorrect": true/false,
  "commentVi": "Nhận xét cụ thể lỗi sai (nếu có) và khen ngợi bằng tiếng Việt",
  "naturalVersionHanzi": "Cách trả lời tiếng Trung tự nhiên hơn như người bản xứ",
  "naturalVersionPinyin": "Pinyin đầy đủ dấu thanh"
}`;

  const res = await callGeminiStructured({
    taskType: 'grade-reading',
    bypassCache: true,
    tier: 'lite',
    systemInstruction: SYSTEM_VI_TEACHER,
    prompt,
    schema: ReadingGradeSchema
  });
  return res.data;
}

// 6. Gia sư Giao tiếp AI (Roleplay Chat + Góp ý sửa lỗi + 3 gợi ý trả lời)
const RoleplayResponseSchema = z.object({
  replyHanzi: z.string(),
  replyPinyin: z.string(),
  replyVi: z.string(),
  tutorFeedback: z
    .object({
      hasError: z.boolean(),
      originalUserText: z.string(),
      correctedHanzi: z.string(),
      correctedPinyin: z.string(),
      explanationVi: z.string(),
      naturalTipVi: z.string()
    })
    .optional(),
  suggestedReplies: z
    .array(
      z.object({
        hanzi: z.string(),
        pinyin: z.string(),
        meaningVi: z.string()
      })
    )
    .min(1)
    .max(3)
});

export type RoleplayAiReply = z.infer<typeof RoleplayResponseSchema>;

export async function roleplayChatAI(params: {
  scenario: string;
  level: number;
  targetWords?: string[];
  history: Array<{ role: 'user' | 'assistant'; text: string }>;
  userMessage: string;
}): Promise<RoleplayAiReply> {
  const histText = params.history
    .slice(-8)
    .map((m) => `${m.role === 'user' ? 'Học viên' : 'Gia sư'}: ${m.text}`)
    .join('\n');

  const injectWords =
    params.targetWords && params.targetWords.length > 0
      ? `Khéo léo lồng ghép 1-2 từ cần ôn sau vào câu trả lời của bạn: ${params.targetWords.slice(0, 8).join('、')}.`
      : '';

  const prompt = `Tình huống đóng vai: ${params.scenario}. Trình độ: HSK ${params.level}.
${injectWords}
Lịch sử hội thoại gần đây:
${histText || '(Bắt đầu cuộc trò chuyện)'}

Tin nhắn mới nhất của học viên: "${params.userMessage}"

Hãy:
1. Trả lời tự nhiên trong vai diễn bằng tiếng Trung Giản thể vừa sức HSK ${params.level} (1-3 câu).
2. Nếu học viên vừa gửi câu tiếng Trung (không phải lệnh bắt đầu), chấm & góp ý sửa lỗi ngữ pháp/dùng từ trong "tutorFeedback".
3. Đưa ra đúng 3 gợi ý cách học viên có thể đáp lại tiếp theo (dễ → tự nhiên).

Trả về JSON:
{
  "replyHanzi": "...",
  "replyPinyin": "...",
  "replyVi": "...",
  "tutorFeedback": {
    "hasError": true/false,
    "originalUserText": "...",
    "correctedHanzi": "...",
    "correctedPinyin": "...",
    "explanationVi": "Nhận xét ngắn rõ bằng tiếng Việt",
    "naturalTipVi": "Cách nói tự nhiên hơn"
  },
  "suggestedReplies": [
    { "hanzi": "...", "pinyin": "...", "meaningVi": "..." }
  ]
}`;

  const res = await callGeminiStructured({
    taskType: 'roleplay-chat',
    bypassCache: true,
    tier: 'primary',
    systemInstruction: SYSTEM_VI_TEACHER,
    prompt,
    schema: RoleplayResponseSchema,
    temperature: 0.6
  });
  return res.data;
}

// 7. Chấm Luyện Đặt câu (Sentence Creation Drill)
const SentenceDrillGradeSchema = z.object({
  score: z.number().min(0).max(10),
  usedTargetWords: z.array(z.string()).default([]),
  summaryVi: z.string(),
  corrections: z
    .array(
      z.object({
        wrongPart: z.string(),
        fixedPart: z.string(),
        reasonVi: z.string()
      })
    )
    .default([]),
  spokenUpgrade: z.object({
    hanzi: z.string(),
    pinyin: z.string(),
    meaningVi: z.string()
  }),
  writtenUpgrade: z.object({
    hanzi: z.string(),
    pinyin: z.string(),
    meaningVi: z.string()
  })
});

export type SentenceDrillGrade = z.infer<typeof SentenceDrillGradeSchema>;

export async function gradeSentenceCreationAI(
  targetWords: string[],
  userSentence: string
): Promise<SentenceDrillGrade> {
  const prompt = `Học viên được yêu cầu đặt câu hoặc đoạn thoại tiếng Trung Giản thể có sử dụng các từ: ${targetWords.join('、')}.
Bài làm của học viên: "${userSentence}"

Hãy chấm điểm thang 10, chỉ rõ từng phần sai (đỏ) và sửa đúng (xanh), giải thích tiếng Việt dễ hiểu, và đề xuất 2 phiên bản nâng cấp: 1 bản Khẩu ngữ (tự nhiên hàng ngày) và 1 bản Văn viết (trang trọng/chặt chẽ).
Trả về JSON:
{
  "score": 0-10,
  "usedTargetWords": ["các từ mục tiêu đã dùng đúng"],
  "summaryVi": "Nhận xét tổng quan",
  "corrections": [
    { "wrongPart": "đoạn sai", "fixedPart": "đoạn sửa đúng", "reasonVi": "lý do" }
  ],
  "spokenUpgrade": { "hanzi": "...", "pinyin": "...", "meaningVi": "..." },
  "writtenUpgrade": { "hanzi": "...", "pinyin": "...", "meaningVi": "..." }
}`;

  const res = await callGeminiStructured({
    taskType: 'sentence-drill',
    bypassCache: true,
    tier: 'primary',
    systemInstruction: SYSTEM_VI_TEACHER,
    prompt,
    schema: SentenceDrillGradeSchema
  });
  return res.data;
}

// 8. OCR & Bóc tách Từ vựng + Câu mẫu từ Tài liệu / Ảnh
const DocumentExtractionSchema = z.object({
  detectedTitle: z.string().optional(),
  rawText: z.string(),
  words: z
    .array(
      z.object({
        simplified: z.string(),
        pinyin: z.string(),
        hanViet: z.string().default(''),
        meaningVi: z.string()
      })
    )
    .default([]),
  sentences: z
    .array(
      z.object({
        hanzi: z.string(),
        pinyin: z.string(),
        translationVi: z.string()
      })
    )
    .default([])
});

export async function extractDocumentAI(input: {
  text?: string;
  imagesBase64?: Array<{ data: string; mimeType: string }>;
}): Promise<z.infer<typeof DocumentExtractionSchema>> {
  const parts: Part[] = (input.imagesBase64 || []).map((img) => ({
    inlineData: { mimeType: img.mimeType, data: img.data }
  }));

  const prompt = `Hãy OCR (nếu có ảnh) và bóc tách tài liệu tiếng Trung sau thành:
1. Toàn bộ văn bản tiếng Trung gốc chuẩn Giản thể ("rawText").
2. Danh sách tối đa 30 từ vựng tiếng Trung quan trọng nhất xuất hiện trong tài liệu (kèm Pinyin chuẩn dấu thanh, âm Hán-Việt, nghĩa tiếng Việt).
3. Danh sách các câu mẫu / hội thoại tiếng Trung tiêu biểu trong tài liệu (kèm Pinyin và dịch tiếng Việt).
${input.text ? `\nNội dung văn bản đầu vào:\n${input.text.slice(0, 6000)}` : ''}
Trả về JSON:
{
  "detectedTitle": "Tiêu đề gợi ý ngắn gọn bằng tiếng Việt",
  "rawText": "Toàn bộ văn bản tiếng Trung đã OCR/làm sạch",
  "words": [{ "simplified": "...", "pinyin": "...", "hanViet": "...", "meaningVi": "..." }],
  "sentences": [{ "hanzi": "...", "pinyin": "...", "translationVi": "..." }]
}`;

  const res = await callGeminiStructured({
    taskType: 'doc-extract',
    bypassCache: true,
    tier: 'primary',
    systemInstruction: SYSTEM_VI_TEACHER,
    prompt,
    parts,
    schema: DocumentExtractionSchema
  });
  return res.data;
}

// 9. Sinh Đề thi HSK 1–6 hoặc Bóc tách Đề thi từ Ảnh/File
const ExamSectionsSchema = z.object({
  title: z.string(),
  level: z.number().min(1).max(6).catch(2),
  durationMinutes: z.number().min(5).max(120).catch(20),
  sections: z
    .array(
      z.object({
        type: z.enum(['listening', 'reading', 'writing']),
        title: z.string(),
        instructionsVi: z.string(),
        questions: z
          .array(
            z.object({
              id: z.string(),
              section: z.enum(['listening', 'reading', 'writing']),
              promptHanzi: z.string(),
              promptPinyin: z.string().optional(),
              promptVi: z.string().optional(),
              audioText: z.string().optional(),
              options: z
                .array(
                  z.object({
                    key: z.string(),
                    hanzi: z.string(),
                    pinyin: z.string().optional(),
                    meaningVi: z.string().optional()
                  })
                )
                .optional(),
              correctAnswer: z.string(),
              explanationVi: z.string().optional()
            })
          )
          .min(1)
      })
    )
    .min(1)
});

export async function generateHskExamAI(params: {
  level: number;
  skill: 'all' | 'listening' | 'reading' | 'writing';
  focusWords?: string[];
}): Promise<{ title: string; level: number; durationMinutes: number; sections: ExamSection[] }> {
  const skillDesc =
    params.skill === 'all'
      ? 'gồm đủ 3 phần: Nghe hiểu (listening - 3 câu, có trường audioText là kịch bản đọc TTS tiếng Trung), Đọc hiểu (reading - 4 câu trắc nghiệm A/B/C/D), Viết (writing - 2 câu sắp xếp từ hoặc viết đoạn ngắn)'
      : params.skill === 'listening'
        ? 'tập trung phần Nghe hiểu (listening - 6 câu trắc nghiệm A/B/C/D, mỗi câu bắt buộc có audioText tiếng Trung)'
        : params.skill === 'reading'
          ? 'tập trung phần Đọc hiểu (reading - 6 câu trắc nghiệm A/B/C/D)'
          : 'tập trung phần Viết (writing - 4 câu sắp xếp câu / đặt câu theo từ khóa)';

  const focusNote =
    params.focusWords && params.focusWords.length > 0
      ? `Ưu tiên lồng ghép các từ học viên hay sai sau vào đề: ${params.focusWords.slice(0, 10).join('、')}.`
      : '';

  const prompt = `Tạo 1 đề thi thử HSK ${params.level} chuẩn thực tế, ${skillDesc}.
${focusNote}
Mọi câu trắc nghiệm đều có 4 lựa chọn key "A", "B", "C", "D" và "correctAnswer" là chữ cái đáp án đúng (ví dụ "B"). Câu viết có "correctAnswer" là đáp án mẫu tiếng Trung.
Trả về đúng JSON theo cấu trúc:
{
  "title": "Đề luyện thi HSK ${params.level} — ...",
  "level": ${params.level},
  "durationMinutes": 20,
  "sections": [
    {
      "type": "listening" | "reading" | "writing",
      "title": "Tên phần bằng tiếng Việt",
      "instructionsVi": "Hướng dẫn làm bài",
      "questions": [
        {
          "id": "q1",
          "section": "listening" | "reading" | "writing",
          "promptHanzi": "Câu hỏi tiếng Trung",
          "promptPinyin": "Pinyin",
          "promptVi": "Gợi ý/yêu cầu tiếng Việt (nếu cần)",
          "audioText": "Kịch bản đọc tiếng Trung (bắt buộc cho listening)",
          "options": [{ "key": "A", "hanzi": "...", "pinyin": "..." }],
          "correctAnswer": "A",
          "explanationVi": "Giải thích ngắn gọn"
        }
      ]
    }
  ]
}`;

  const res = await callGeminiStructured({
    taskType: 'hsk-exam-gen',
    bypassCache: true,
    tier: 'primary',
    systemInstruction: SYSTEM_VI_TEACHER,
    prompt,
    schema: ExamSectionsSchema,
    temperature: 0.55
  });
  return res.data;
}

export async function importExamFromContentAI(input: {
  text?: string;
  imagesBase64?: Array<{ data: string; mimeType: string }>;
}): Promise<{ title: string; level: number; durationMinutes: number; sections: ExamSection[] }> {
  const parts: Part[] = (input.imagesBase64 || []).map((img) => ({
    inlineData: { mimeType: img.mimeType, data: img.data }
  }));

  const prompt = `Hãy bóc tách đề thi tiếng Trung từ tài liệu/ảnh đính kèm thành đề thi tương tác JSON.
Giữ nguyên các câu hỏi, phân loại vào section "listening", "reading" hoặc "writing", trích xuất đầy đủ đáp án A/B/C/D (nếu trắc nghiệm) và tự giải để điền "correctAnswer" cùng "explanationVi".
${input.text ? `\nNội dung văn bản:\n${input.text.slice(0, 7000)}` : ''}
Trả về JSON theo cấu trúc { "title", "level", "durationMinutes", "sections": [...] }.`;

  const res = await callGeminiStructured({
    taskType: 'hsk-exam-import',
    bypassCache: true,
    tier: 'primary',
    systemInstruction: SYSTEM_VI_TEACHER,
    prompt,
    parts,
    schema: ExamSectionsSchema
  });
  return res.data;
}

// 10. AI Giải đề chi tiết + Chấm phần Viết
const ExamExplainSchema = z.object({
  explanations: z.array(
    z.object({
      questionId: z.string(),
      whyCorrectVi: z.string(),
      distractorTrapVi: z.string(),
      grammarPointVi: z.string(),
      translationVi: z.string(),
      writingScore: z.number().min(0).max(10).optional(),
      writingRevisionHanzi: z.string().optional()
    })
  )
});

export async function explainExamMistakesAI(
  examId: string,
  level: number,
  items: Array<{ question: ExamQuestion; userAnswer: string }>
): Promise<ExamAiExplanation[]> {
  const formatted = items
    .map(
      (it, idx) =>
        `[${idx + 1}] id=${it.question.id} | section=${it.question.section}\n` +
        `Đề: ${it.question.promptHanzi}\n` +
        (it.question.audioText ? `Audio: ${it.question.audioText}\n` : '') +
        (it.question.options
          ? `Lựa chọn: ${it.question.options.map((o) => `${o.key}.${o.hanzi}`).join(' | ')}\n`
          : '') +
        `Đáp án chuẩn: ${it.question.correctAnswer} | Học viên trả lời: ${it.userAnswer || '(Bỏ trống)'}`
    )
    .join('\n---\n');

  const prompt = `Giải thích chi tiết từng câu hỏi sau (trình độ HSK ${level}) cho người Việt.
Với câu phần Viết (writing), chấm thêm "writingScore" (0-10) và gợi ý "writingRevisionHanzi".
Danh sách câu cần giải:\n${formatted}

Trả về JSON:
{
  "explanations": [
    {
      "questionId": "đúng id câu hỏi",
      "whyCorrectVi": "Vì sao đáp án chuẩn là đúng",
      "distractorTrapVi": "Phân tích bẫy của đáp án sai / lỗi học viên mắc",
      "grammarPointVi": "Điểm ngữ pháp / từ vựng mấu chốt",
      "translationVi": "Dịch trọn câu sang tiếng Việt",
      "writingScore": 8,
      "writingRevisionHanzi": "câu viết sửa lại chuẩn hơn (nếu là câu viết)"
    }
  ]
}`;

  const res = await callGeminiStructured({
    taskType: 'exam-explain',
    cacheKey: `${examId}:${items.map((i) => `${i.question.id}=${i.userAnswer}`).join('|')}`,
    tier: 'primary',
    systemInstruction: SYSTEM_VI_TEACHER,
    prompt,
    schema: ExamExplainSchema
  });

  return res.data.explanations;
}

// 11. Chép lời Audio tiếng Trung hoặc tiếng Việt (STT fallback cho Windows Electron & Android dự phòng)
const TranscribeSchema = z.object({
  transcript: z.string(),
  pinyin: z.string().default(''),
  toneTipVi: z.string().optional()
});

export async function transcribeChineseAudioAI(
  audioBase64: string,
  mimeType: string,
  lang: 'zh-CN' | 'vi-VN' = 'zh-CN'
): Promise<z.infer<typeof TranscribeSchema>> {
  const prompt =
    lang === 'vi-VN'
      ? 'Nghe đoạn ghi âm tiếng Việt (có thể xen vài từ tiếng Trung) đính kèm và chép lại CHÍNH XÁC nội dung người nói. ' +
        'Trả về JSON: { "transcript": "nội dung chép lời chính xác", "pinyin": "", "toneTipVi": "" }.'
      : 'Nghe đoạn ghi âm tiếng Trung Giản thể đính kèm và chép lại CHÍNH XÁC những gì người nói phát âm (không tự sửa lỗi của họ, giữ nguyên chữ Hán giản thể tương ứng với âm họ nói). ' +
        'Trả về JSON: { "transcript": "chữ Hán giản thể", "pinyin": "pinyin người nói phát âm", "toneTipVi": "nhận xét ngắn 1 câu về thanh điệu/phát âm bằng tiếng Việt" }.';

  const res = await callGeminiStructured({
    taskType: 'stt-audio',
    bypassCache: true,
    tier: 'lite',
    prompt,
    parts: [{ inlineData: { mimeType, data: audioBase64 } }],
    schema: TranscribeSchema,
    temperature: 0.1
  });
  return res.data;
}
