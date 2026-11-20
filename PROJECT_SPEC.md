# PROJECT_SPEC.md — Đặc tả Kiến trúc HanziMaster AI

> **Phiên bản:** 1.0.0  
> **Nền tảng:** 1 mã nguồn duy nhất (`React 18 + TypeScript + Vite + Tailwind CSS`) → **Windows (`.exe` NSIS & Portable qua Electron)** và **Android (`.apk` qua Capacitor 7)**  
> **Nguyên tắc cốt lõi:** Offline-First 100% • 0đ chi phí vận hành server • BYOK Google AI Studio (Gemini mới nhất) • Giao diện hoàn toàn tiếng Việt tự nhiên

---

## 1. Mục tiêu & Tiêu chí Thành công

Xây dựng ứng dụng học tiếng Trung Giản thể All-in-One (**HSK 1–6** & mở rộng **HSK 3.0 Cấp 1–9**) vận hành không cần máy chủ backend trả phí:
- Toàn bộ kho từ điển, nét vẽ MakeMeAHanzi, lịch ôn tập FSRS, 7 trò chơi Memory Arcade, đề thi mẫu, bài khóa và kết quả AI đều lưu cục bộ trên **IndexedDB (Dexie.js)**.
- Tìm kiếm từ điển cục bộ `< 50ms`, vẽ tay nhận diện chữ Hán offline qua so khớp `medians` MakeMeAHanzi, luyện viết nét `hanzi-writer` chạy 100% offline.
- Tích hợp **Google AI Studio (Gemini API BYOK)** ưu tiên model Free Tier mới nhất (`gemini-3.8-flash`, `gemini-3.5-flash-lite`), hỗ trợ tải danh sách model động (`models.list`), chuỗi fallback chống `429`, hàng đợi `RequestQueue`, Structured JSON Output có kiểm duyệt Zod, và lưu cache vĩnh viễn vào `aiCache`.
- Hỗ trợ đồng bộ hai nền tảng từ cùng một codebase (`HashRouter`), vượt qua `npx tsc --noEmit`, `npm test`, `npm run build` với **0 lỗi**, kèm workflow GitHub Actions tự động xuất `.apk` và `.exe`.

---

## 2. Các Quyết định Kiến trúc Đã Chốt (ADRs)

| # | Quyết định | Lý do & Chi tiết triển khai |
|---|---|---|
| **ADR-01** | **Gemini Model Strategy** | Mặc định **`gemini-3.8-flash`** (tác vụ nặng: bài khóa, giải đề, OCR, phân tích cách dùng từ, chấm đặt câu) + **`gemini-3.5-flash-lite`** (tác vụ nhẹ: gợi ý trả lời chat, chiết tự nhanh, STT audio fallback). Hỗ trợ nút **"Tải danh sách model mới nhất"** (`GET /v1beta/models`) và chuỗi fallback tự động `gemini-3.8-flash → gemini-3.6-flash → gemini-3.5-flash-lite → gemini-2.5-flash` khi gặp 429/quota. |
| **ADR-02** | **Microsoft Edge TTS 0đ đa nền tảng** | WebView chặn header WebSocket (`403`), do đó: **Windows Electron** chạy Edge TTS trực tiếp trong Main Process qua IPC (`electron/edgeTts.ts`); **Android Capacitor 7** đóng gói plugin native gọn nhẹ (`EdgeTtsPlugin.java` dùng OkHttp WebSocket) + fallback `@capacitor-community/text-to-speech`; **Web Dev** dùng Vite dev proxy + Web Speech API (và hỗ trợ ô Proxy URL tùy chọn). Toàn bộ audio cache LRU 50MB trong `audioCache`. |
| **ADR-03** | **Capacitor 7 cho Android** | Dùng Capacitor 7 (JDK 21, Android API 35) thay Capacitor 6 (hết hỗ trợ) vì tương thích sạch peer dependencies với cả `@capacitor-community/text-to-speech@7` và `@capacitor-community/speech-recognition@7`. |
| **ADR-04** | **Kho từ điển Offline 2 tầng** | **Tầng 1 (nhúng sẵn trong app):** 520+ từ lõi HSK 1–3 biên soạn **100% tiếng Việt chuẩn**, kèm nét vẽ MakeMeAHanzi thực (`strokes`, `medians`, `decomposition`, `etymology`), hình cận tự, cách dùng 4 tầng và 2 đề thi mẫu HSK 1–3. **Tầng 2 (`npm run build:dict`):** Script `scripts/build-offline-db.mjs` biên dịch Full DB (>9.500 chữ MakeMeAHanzi + CC-CEDICT + HSK 1–6 & 3.0 + bảng Hán-Việt) nạp qua Web Worker; hỗ trợ 1 chạm AI dịch & phân tích cách dùng tiếng Việt lưu vĩnh viễn. |
| **ADR-05** | **Font chữ Hán Offline** | Ưu tiên stack font hệ thống sắc nét (`PingFang SC`, `Microsoft YaHei`, `Noto Sans CJK SC`, `KaiTi`, `STKaiti`) + cache Google Fonts (`Noto Sans SC`, `LXGW WenKai`) khi online để giữ gói `.apk`/`.exe` nhẹ. Toàn bộ luyện viết nét dùng SVG vector MakeMeAHanzi 100% offline. |
| **ADR-06** | **STT 3 tầng cho Shadowing & Voice** | Android: `@capacitor-community/speech-recognition` (`zh-CN`); Web Browser: Web Speech API; **Windows Electron** (hoặc khi Web Speech báo `network`): `MediaRecorder` + gửi audio ngắn sang `gemini-3.5-flash-lite` khi online, hoặc chế độ **Tự nghe đối chiếu (Self-Check)** khi offline. |
| **ADR-07** | **Tách từ thông minh `<InteractiveHanziText>`** | Kết hợp **Longest-Match (Maximum Forward Matching)** trên chỉ mục bộ từ điển IndexedDB + `Intl.Segmenter('zh-CN')`. Popover Tap-to-Lookup hiển thị cả từ ghép đầy đủ lẫn thanh chọn từng chữ đơn cấu tạo để xem chiết tự/nét vẽ. |
| **ADR-08** | **`hanzi-writer` Offline-First** | Custom `charDataLoader` ưu tiên đọc từ bảng `hanziGraphics` trong IndexedDB; chỉ tải bù từ CDN khi gặp chữ hiếm ngoài DB rồi tự lưu vĩnh viễn ngược vào IndexedDB. |
| **ADR-09** | **HSK 2.0 & HSK 3.0 song song** | Lưu đồng thời `hskLevel` (`1..6`) và `hsk3Level` (`1..9`), mặc định hiển thị HSK 1–6, cho bật mở rộng HSK 3.0 (1–9) trong Cài đặt & Bộ lọc. |
| **ADR-10** | **Bảo mật Key, LRU Cache & Onboarding** | Electron dùng `safeStorage` mã hóa API Key khi hỗ trợ; Backup `.json` mặc định **không xuất API Key**; LRU `audioCache` mặc định **50 MB**; Onboarding 1 bước có thể bấm **"Bỏ qua — Dùng Offline ngay"**. |
| **ADR-11** | **Đóng gói CI/CD & App ID** | `appId = com.hanzimaster.ai`, tên `HanziMaster AI`. GitHub Actions xuất `HanziMaster-AI-Setup.exe`, `HanziMaster-AI-Portable.exe`, `HanziMaster-AI-debug.apk` và tự ký `app-release.apk` nếu có Keystore secrets (không fail CI nếu chưa cấu hình secrets). |

---

## 3. Công nghệ & Lệnh thực thi

### Stack
- **UI & State:** React 18, TypeScript 5, Vite 6, Tailwind CSS 3, `lucide-react`, `zustand`, `react-router-dom` (`HashRouter`).
- **Offline DB & SRS:** `dexie` (IndexedDB), `ts-fsrs`, `hanzi-writer`.
- **AI & Validation:** `@google/genai`, `zod`.
- **Tài liệu:** `pdfjs-dist`, `mammoth`.
- **Desktop & Mobile:** `electron`, `electron-builder`, `@capacitor/core@7`, `@capacitor/android@7`, `@capacitor/app`, `@capacitor/camera`, `@capacitor/filesystem`, `@capacitor/share`, `@capacitor-community/text-to-speech`, `@capacitor-community/speech-recognition`.
- **Kiểm thử:** `vitest`, `@testing-library/react`.

### Các lệnh trong `package.json`
```bash
npm run dev            # Chạy Web Dev Server (kèm Vite dev proxy Edge TTS)
npm run typecheck      # Kiểm tra TypeScript (npx tsc --noEmit)
npm test               # Chạy bộ unit test Vitest
npm run build          # Build bản production web (dist/)
npm run dev:electron   # Chạy app Desktop Electron chế độ phát triển
npm run build:win      # Đóng gói Windows NSIS (.exe) và Portable (.exe)
npm run build:android  # Build web + đồng bộ Capacitor Android & chèn native plugin
npm run build:dict     # Tải & biên dịch Full DB (>9.500 chữ MakeMeAHanzi + CC-CEDICT + HSK + Hán-Việt)
```

---

## 4. Quy ước UI/UX Bắt buộc

1. **Light / Dark Mode** tối giản, tương phản cao, chữ Hán lớn rõ ràng, hỗ trợ chuyển nhanh trên header & Cài đặt.
2. **Adaptive Layout:**
   - **Mobile (`< 768px`):** Thao tác 1 tay, Safe Area (`env(safe-area-inset-*)`), xử lý nút Back vật lý Android, **Bottom Tab Bar 5 mục**: *Hôm nay* (`/`), *Từ điển & Viết* (`/dictionary`), *Trò chơi* (`/arcade`), *Gia sư AI* (`/tutor`), *Kho & Đề thi* (`/library`) + nút *Thống kê* & *Cài đặt* trên thanh trên cùng.
   - **Desktop (`>= 1024px`):** Sidebar gọn bên trái + **Split-View** bên phải (mở song song Từ điển / Chi tiết từ / Luyện viết ngay khi đang học Bài khóa, Chat AI, Làm đề hoặc đọc Tài liệu) + phím tắt toàn cục:
     - `Ctrl+K`: Mở tra nhanh từ điển / Split-View
     - `Ctrl+P`: Bật/tắt Pinyin toàn cục
     - `Ctrl+M`: Bật/tắt Dịch nghĩa toàn cục
3. **Anti-Crutch (`useDisplayStore` + `DisplayControlBar`):**
   - Trạng thái đồng bộ toàn app: `showPinyin`, `showMeaning`, `showHanViet`, `defaultHideInPractice`.
   - **Tap-to-Peek:** Khi ẩn Pinyin hoặc Dịch nghĩa, nội dung hiển thị dạng dải mờ gọn gàng; chạm trực tiếp vào 1 từ/câu bị mờ sẽ hé lộ **3 giây** rồi tự động ẩn lại.
   - Tùy chọn **Ẩn mặc định khi ôn tập/chơi game** + công tắc **Hardcore Mode** (`x2 EXP` + cộng thưởng ổn định FSRS).
4. **Tap-to-Lookup toàn cục (`<InteractiveHanziText>`):**
   - Mọi văn bản tiếng Trung trong app đi qua component này.
   - Chạm từ bất kỳ → Popover hiện: Chữ Hán, Pinyin, Hán-Việt, nghĩa, chiết tự ngắn, thanh chuyển từng chữ đơn, nút **Nghe phát âm**, nút **`+ Lưu vào sổ ôn`**, nút **`Shadowing`**, nút **`Xem chi tiết`** (mở vào Split-View trên desktop hoặc trang chi tiết trên mobile).

---

## 5. Schema IndexedDB (`src/db/database.ts` — Dexie.js)

```ts
// 10 bảng cốt lõi trong HanziMasterDB (Dexie v1)
dictionary:    'id, simplified, pinyin, pinyinNoTone, hskLevel, hsk3Level, frequency, strokesCount, radical, *searchTokens'
hanziGraphics: 'char, strokesCount, radical'
userVocab:     'id, wordId, simplified, status, isLeech, nextReviewAt, source, addedAt'
lessons:       'id, date, level, sourceType, completed, createdAt'
documents:     'id, title, fileType, createdAt'
examHistory:   'id, level, score, createdAt'
aiCache:       'cacheKey, type, createdAt'
audioCache:    'textHash, createdAt, lastAccessedAt, sizeBytes'
studyLogs:     'date'
settings:      'key'
```

### Chi tiết các cấu trúc JSON quan trọng
- **`DictionaryEntry.usageDetailsJson`:**
  ```ts
  interface UsageDetails {
    senses: Array<{
      partOfSpeech: string;          // Danh từ, Động từ, Tính từ, Phó từ, Liên từ...
      register: 'khẩu ngữ' | 'văn viết' | 'trang trọng' | 'trung tính';
      meaningVi: string;
      grammarPattern: string;        // VD: A + 比 + B + Tính từ
      collocations: string[];        // Cụm từ cố định
      examples: Array<{
        hanzi: string;
        pinyin: string;
        literalVi: string;           // Nghĩa sát từng từ
        translationVi: string;       // Dịch tiếng Việt tự nhiên
      }>;
    }>;
    confusableComparisons?: Array<{
      word: string;
      pinyin: string;
      differenceVi: string;
      exampleContrast: string;
    }>;
    mnemonicStoryVi?: string;
    aiEnriched?: boolean;
    updatedAt?: number;
  }
  ```
- **`UserVocabItem`:** Liên kết `wordId`, lưu `fsrsCardJson` (chuẩn `ts-fsrs`), `wrongCount`, `isLeech` (`wrongCount >= 3`), `status` (`'new' | 'learning' | 'mastered'`), `source` (`'hsk' | 'lookup' | 'document' | 'lesson' | 'exam'`), `nextReviewAt`.
- **`AudioCacheItem`:** Khóa `textHash = sha/fnv(text + voice + rate)`, lưu `audioBlob`, `sizeBytes`, `lastAccessedAt` để dọn LRU tự động khi vượt `maxAudioCacheMB` (mặc định 50 MB).

---

## 6. Cấu trúc Thư mục Dự kiến

```text
.
├── .github/workflows/build.yml        # CI/CD tự động build Windows .exe & Android .apk
├── PROJECT_SPEC.md                    # Đặc tả kiến trúc & schema (tệp này)
├── PROGRESS.md                        # Bảng theo dõi tiến độ 6 Mốc
├── BUILD_AND_USER_GUIDE.md            # Hướng dẫn chạy, lấy Gemini Key & build .apk/.exe
├── capacitor.config.ts                # Cấu hình Capacitor 7 (com.hanzimaster.ai)
├── electron-builder.yml               # Cấu hình đóng gói NSIS + Portable Windows .exe
├── android-plugin/                    # Plugin Java Native Edge TTS (OkHttp) cho Android
│   └── EdgeTtsPlugin.java
├── electron/                          # Electron Desktop Shell
│   ├── main.ts                        # Cửa sổ chính, IPC Edge TTS, safeStorage Key
│   ├── preload.ts                     # Bridge bảo mật contextBridge
│   └── edgeTts.ts                     # Client Microsoft Edge TTS WebSocket Node.js
├── scripts/
│   ├── build-offline-db.mjs           # Tải & biên dịch Full DB (>9.500 chữ + CC-CEDICT + HSK)
│   └── sync-android-plugin.mjs        # Tự gắn EdgeTtsPlugin vào thư mục android/ khi sync
├── public/data/                       # Gói dữ liệu JSON nạp qua Web Worker (khi chạy build:dict)
└── src/
    ├── main.tsx & App.tsx             # HashRouter, ErrorBoundary, khởi tạo DB & Stores
    ├── index.css                      # Tailwind, Light/Dark CSS tokens, Safe Area, Font stacks
    ├── types/                         # Định nghĩa kiểu dữ liệu chung (dictionary, fsrs, ai, exam...)
    ├── data/                          # Bộ dữ liệu nhúng offline 100% tiếng Việt chuẩn
    │   ├── embeddedWords.ts           # 520+ từ HSK 1–3 chuẩn tiếng Việt, ví dụ 4 tầng
    │   ├── coreGraphics.json          # Nét vẽ MakeMeAHanzi thực (strokes + medians + decomposition)
    │   ├── radicals214.ts             # 214 bộ thủ Khang Hy kèm nghĩa tiếng Việt & Hán-Việt
    │   ├── confusables.ts             # Cặp chữ hình cận tự & đồng âm dễ nhầm
    │   └── mockExams.ts               # 2 đề thi mẫu chuẩn HSK 1 & HSK 2–3 offline
    ├── db/
    │   ├── database.ts                # Dexie.js schema 10 bảng
    │   └── seed.ts                    # Khởi tạo bộ lõi + nạp gói Full DB bằng Web Worker
    ├── workers/
    │   └── dictLoader.worker.ts       # Web Worker nạp theo lô 500–1000 dòng không lag UI
    ├── stores/
    │   ├── useDisplayStore.ts         # Anti-Crutch toàn cục (Pinyin, Nghĩa, Hán-Việt, Hardcore)
    │   └── useAppStore.ts             # Theme, Online/Offline, Split-View, Toast, Settings sync
    ├── services/
    │   ├── ai/                        # geminiClient.ts (Queue, Backoff, Fallback, Cache) & aiTasks.ts
    │   ├── tts/                       # ttsService.ts (Edge IPC/Android -> LRU Cache -> Native/Web)
    │   ├── stt/                       # sttService.ts (Capacitor -> Web Speech -> Gemini Audio/Self-Check)
    │   ├── dictionary/                # dictionaryService.ts (<50ms search) & tokenizer.ts
    │   ├── handwriting/               # matcher.ts (Resample + Medians) & hanziWriterLoader.ts
    │   ├── fsrs/                      # fsrsService.ts (ts-fsrs, Leech, EXP, StudyLogs)
    │   ├── parser/                    # documentParser.ts (Image, PDF, DOCX, TXT + UserVocab diff)
    │   └── backup/                    # backupService.ts (Export/Import JSON Overwrite/Smart Merge)
    ├── components/
    │   ├── layout/                    # AppShell, Sidebar, BottomTabBar, SplitViewPane, QuickSearchModal
    │   └── common/                    # DisplayControlBar, InteractiveHanziText, ShadowingModal, OnboardingModal...
    └── features/
        ├── daily-lesson/              # Bài khóa đổi mới hàng ngày + Đọc hiểu + Chấm câu
        ├── dictionary/                # Tra từ, Bộ lọc HSK/Bộ thủ/Số nét, Chi tiết 4 Tab
        ├── writing/                   # HandwritingPad (米字格) + Luyện viết hanzi-writer
        ├── arcade/                    # Memory Arcade Hub + 7 trò chơi tương ứng 7 phương pháp
        ├── ai-tutor/                  # Roleplay Chat + Luyện Đặt câu thực chiến
        ├── documents/                 # Nạp ảnh/PDF/DOCX/TXT + Duyệt OCR + Học tài liệu
        ├── exams/                     # 3 nguồn đề HSK + Phòng thi + AI Giải đề chi tiết
        ├── stats/                     # Streak, Heatmap 365 ngày, % HSK, Quản lý Sổ từ & Tử huyệt
        └── settings/                  # Gemini BYOK, Model Discovery, TTS, Bộ nhớ, Backup JSON
```

---

## 7. Ranh giới & Quy tắc Chất lượng

- **Luôn thực hiện:**
  - Chạy `npx tsc --noEmit` sau mỗi mốc; sửa sạch lỗi TypeScript trước khi sang mốc kế tiếp.
  - Mọi văn bản tiếng Trung hiển thị cho người học đều đi qua `<InteractiveHanziText>` và tuân thủ `DisplayControlBar` + Tap-to-Peek 3 giây.
  - Mọi lệnh gọi Gemini đều qua `geminiClient` (cache → queue → validate Zod → fallback → thông báo lỗi tiếng Việt thân thiện khi offline hoặc hết quota).
- **Không bao giờ làm:**
  - Không để nút giả, luồng rỗng, hoặc `TODO` chặn tính năng chính.
  - Không lưu cứng API Key trong mã nguồn hoặc xuất API Key mặc định vào file backup JSON.
  - Không để phụ thuộc CDN cứng khiến `hanzi-writer` hay từ điển lỗi khi tắt mạng.
