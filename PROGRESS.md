# PROGRESS.md — Bảng Theo dõi Tiến độ HanziMaster AI

> Cập nhật sau khi hoàn tất toàn bộ 6 Mốc và vượt qua cổng kiểm tra `npx tsc --noEmit`, `npm test` (10/10 pass) và `npm run build` (0 lỗi).

## Tổng quan 6 Mốc

| Mốc | Phạm vi chính | Trạng thái | Kiểm chứng |
|---|---|---|---|
| **Mốc 1** | Nền tảng dự án, Dexie DB 10 bảng, Electron + Capacitor 7 Shell, Layout Adaptive + Split-View, Anti-Crutch & `<InteractiveHanziText>` | ✅ Hoàn thành | `tsc --noEmit` (0 lỗi) + `vitest` + `vite build` |
| **Mốc 2** | Từ điển Offline (500+ từ lõi tiếng Việt + 1.327 chữ MakeMeAHanzi thực + `build:dict` Full DB), Tìm kiếm `<50ms`, Vẽ tay nhận diện offline/AI, Chi tiết 4 Tab | ✅ Hoàn thành | `tsc --noEmit` (0 lỗi) + `vitest` |
| **Mốc 3** | Lõi FSRS (`ts-fsrs`), Sổ Tử huyệt (Leech), Memory Arcade trọn bộ 7 Trò chơi + Hardcore Mode | ✅ Hoàn thành | `tsc --noEmit` (0 lỗi) + `vitest` |
| **Mốc 4** | Gemini BYOK (`gemini-3.8-flash` / `3.5-flash-lite` / `models.list` / Fallback / Queue / Cache), Bài khóa Hàng ngày, Gia sư AI (Roleplay + Đặt câu) | ✅ Hoàn thành | `tsc --noEmit` (0 lỗi) + `vitest` |
| **Mốc 5** | TTS 0đ (Electron IPC + Android OkHttp Plugin + LRU Cache + Native Fallback), STT 3 tầng + Shadowing, Nạp Tài liệu (Ảnh/PDF/DOCX/TXT), Làm đề & Giải đề HSK | ✅ Hoàn thành | `tsc --noEmit` (0 lỗi) + `vitest` |
| **Mốc 6** | Thống kê (Streak, Heatmap 365, % HSK, Sổ từ), Quản lý Bộ nhớ, Sao lưu JSON (Ghi đè/Gộp), Cài đặt đầy đủ, GitHub Actions `.apk`/`.exe`, `BUILD_AND_USER_GUIDE.md` | ✅ Hoàn thành | `tsc --noEmit` + `vitest` (10/10) + `npm run build` (0 lỗi) |

---

## Checklist Chi tiết từng Mốc

### Mốc 1 — Nền tảng, DB & Core UI
- [x] Khởi tạo `package.json`, TypeScript, Vite, Tailwind CSS, Vitest, Electron, Capacitor 7
- [x] Cấu hình Electron (`electron/main.ts`, `preload.ts`, `edgeTts.ts`, `electron-builder.yml`)
- [x] Tạo Android Native Edge TTS Plugin (`android-plugin/EdgeTtsPlugin.java`, `scripts/sync-android-plugin.mjs`, `capacitor.config.ts`)
- [x] Xây dựng `src/types/` và `src/db/database.ts` (10 bảng IndexedDB có index tối ưu) + Web Worker nạp DB
- [x] Xây dựng `useDisplayStore` (Anti-Crutch + Tap-to-Peek 3s) & `useAppStore` (Theme, Online/Offline, Split-View, Hotkeys)
- [x] Xây dựng `AppShell` (Bottom Tab Bar 5 mục, Safe Area, Android Back, Desktop Sidebar + Split-View + `Ctrl+K/P/M`)
- [x] Xây dựng `DisplayControlBar`, `<InteractiveHanziText>` (Longest-Match + `Intl.Segmenter` + Popover Từ ghép/Chữ đơn), `OnboardingModal`
- [x] Cổng kiểm tra Mốc 1: `npx tsc --noEmit` 0 lỗi

### Mốc 2 — Từ điển Offline, Vẽ tay & Chi tiết 4 Tab
- [x] Bộ từ điển lõi nhúng sẵn 500+ từ HSK 1–3 chuẩn tiếng Việt + 214 bộ thủ + cặp hình cận tự + 1.327 nét vẽ MakeMeAHanzi thực (`src/data/coreGraphics.json`)
- [x] Script `scripts/build-offline-db.mjs` biên dịch Full DB (>9.500 chữ + CC-CEDICT + HSK 1–6 & 3.0 + Hán-Việt)
- [x] `dictionaryService.ts`: tìm kiếm `<50ms` đa chiều (Hán, Pinyin dấu/không dấu/số thanh, Việt, Hán-Việt) + lọc HSK 2.0/3.0, bộ thủ, số nét
- [x] `matcher.ts` (nhận diện vẽ tay offline so khớp `medians`) + `hanziWriterLoader.ts` (100% offline từ IndexedDB)
- [x] `HandwritingPad.tsx` (lưới 米字格, hoàn tác, xóa, tự nhận diện, ghép nhiều chữ, AI Vision)
- [x] `DictionaryPage.tsx` & `WordDetailView.tsx` (4 Tab: Tổng quan & Nét viết, Cách dùng 4 tầng + AI phân tích cache vĩnh viễn, Chiết tự & Bộ thủ, Luyện viết Tô nét & Viết mù)
- [x] Cổng kiểm tra Mốc 2: `npx tsc --noEmit` & unit tests pass

### Mốc 3 — FSRS, Tử huyệt & Memory Arcade (7 Trò chơi)
- [x] `fsrsService.ts` (`ts-fsrs`, cờ Leech sai >= 3 lần, Hardcore bonus, ghi `studyLogs`)
- [x] `ArcadeHubPage.tsx` (4 nguồn từ: FSRS / HSK / Bài khóa-Tài liệu / Phòng cấp cứu Leech + Hardcore Mode x2 EXP)
- [x] Game 1: Đấu trường Tốc độ & Lật thẻ 4 chiều (`SpeedRecallGame`)
- [x] Game 2: Lấp đầy Bài khóa (`ContextClozeGame` — Trắc nghiệm / Gõ / Vẽ tay)
- [x] Game 3: Ghép cầu Ngữ pháp (`SentenceBuilderGame`)
- [x] Game 4: Lò rèn Bộ thủ & Chém Thanh điệu (`HanziCraftAndToneGame`)
- [x] Game 5: Truy tìm Giả mạo (`ConfusableHunterGame`)
- [x] Game 6: Luyện viết mù (`BlindStrokeGame`)
- [x] Game 7: Đấu Trùm Bài Học 4 pha (`LessonBossRaidGame`)
- [x] Cổng kiểm tra Mốc 3: `npx tsc --noEmit` & unit tests pass

### Mốc 4 — Gemini BYOK, Bài khóa Hàng ngày & Gia sư AI
- [x] `geminiClient.ts` (`@google/genai`, `gemini-3.8-flash` / `3.5-flash-lite`, `models.list`, fallback 429, `RequestQueue`, backoff, Structured JSON + Zod, `aiCache`, bộ đếm ngày)
- [x] `aiTasks.ts` (phân tích từ, chiết tự, Vision vẽ tay, bài khóa ngày, đọc hiểu, roleplay chat, chấm đặt câu, OCR tài liệu, sinh/giải đề HSK, STT audio)
- [x] `DailyLessonPage.tsx` (đổi mới theo `YYYY-MM-DD`, trộn 60% mới + 40% ôn/tử huyệt, đọc hiểu + chấm câu, nút vào Arcade & đổi chủ đề)
- [x] `AiTutorPage.tsx` (Roleplay Chat theo tình huống + gài từ chưa thuộc + 3 gợi ý + Góp ý Gia sư; Luyện Đặt câu chấm /10 + diff đỏ/xanh + 2 bản nâng cấp + cộng FSRS)
- [x] Cổng kiểm tra Mốc 4: `npx tsc --noEmit` & unit tests pass

### Mốc 5 — Tài liệu, Đề thi HSK, TTS 0đ & Shadowing
- [x] `ttsService.ts` (Edge TTS IPC/Android/Proxy + LRU 50MB IndexedDB + Web Speech / Capacitor Native fallback)
- [x] `sttService.ts` (Capacitor STT / Web Speech / Electron MediaRecorder+Gemini Audio / Offline Self-Check + diff chấm từng chữ & Pinyin)
- [x] `ShadowingModal.tsx` (Nghe lặp A-B → Thu âm → So khớp xanh/đỏ/vàng + Pinyin)
- [x] `documentParser.ts` & `DocumentsPage.tsx` (Chụp ảnh/Ảnh/PDF/DOCX/TXT/Dán → bóc tách & đối chiếu `userVocab` 3 màu → Duyệt sửa OCR → Lưu thành bài học)
- [x] `mockExams.ts` (2 đề mẫu HSK 1 & 2–3 offline) & `ExamsPage.tsx` (3 nguồn đề, Phòng thi có đếm giờ & TTS Nghe, chấm tự động + AI chấm Viết, AI Giải đề cache vĩnh viễn)
- [x] Cổng kiểm tra Mốc 5: `npx tsc --noEmit` & unit tests pass

### Mốc 6 — Thống kê, Cài đặt, Sao lưu & Đóng gói CI/CD
- [x] `StatsPage.tsx` (Streak, Heatmap 365 ngày, vòng tròn mục tiêu ngày, biểu đồ % HSK 1–6 / 3.0, quản lý Sổ từ & Tử huyệt)
- [x] `backupService.ts` (Xuất/Nhập `.json` Ghi đè & Gộp thông minh, ẩn API Key mặc định, đo dung lượng & dọn audio cache an toàn)
- [x] `SettingsPage.tsx` (đầy đủ cấu hình giao diện, Anti-Crutch, HSK, Gemini BYOK & `models.list`, TTS, Bộ nhớ, Backup)
- [x] `.github/workflows/build.yml` & `BUILD_AND_USER_GUIDE.md`
- [x] Cổng kiểm tra cuối cùng: `npx tsc --noEmit`, `npm test`, `npm run build` — **0 lỗi**
