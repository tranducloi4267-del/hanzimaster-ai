import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Database,
  Download,
  HardDrive,
  KeyRound,
  Loader2,
  Moon,
  RefreshCw,
  Settings,
  Sun,
  Trash2,
  Upload,
  Volume2
} from 'lucide-react';
import { useAppStore } from '@/stores/useAppStore';
import { useDisplayStore } from '@/stores/useDisplayStore';
import {
  fetchAvailableGeminiModels,
  testGeminiConnection
} from '@/services/ai/geminiClient';
import {
  clearAudioCache,
  EDGE_CHINESE_VOICES,
  speakChinese
} from '@/services/tts/ttsService';
import {
  downloadOrShareBackup,
  formatBytes,
  importBackupJson,
  measureStorageUsage,
  type StorageBreakdown
} from '@/services/backup/backupService';
import { importFullDatabaseViaWorker } from '@/db/seed';
import { invalidateDictionaryCache } from '@/services/dictionary/dictionaryService';
import { invalidateHandwritingIndex } from '@/services/handwriting/matcher';

export const SettingsPage: React.FC = () => {
  const { settings, updateSettings, pushToast, initApp } = useAppStore();
  const { defaultHideInPractice, setDefaultHideInPractice } = useDisplayStore();

  const [apiKeyInput, setApiKeyInput] = useState(settings.geminiApiKey);
  const [testingKey, setTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [fetchingModels, setFetchingModels] = useState(false);

  const [storage, setStorage] = useState<StorageBreakdown | null>(null);
  const [fullDbProgress, setFullDbProgress] = useState<{
    active: boolean;
    percent: number;
    message: string;
  }>({ active: false, percent: 0, message: '' });

  const [includeKeyInBackup, setIncludeKeyInBackup] = useState(false);
  const [importMode, setImportMode] = useState<'merge' | 'overwrite'>('merge');
  const importFileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setApiKeyInput(settings.geminiApiKey);
  }, [settings.geminiApiKey]);

  const refreshStorage = async () => {
    setStorage(await measureStorageUsage());
  };

  useEffect(() => {
    refreshStorage();
  }, []);

  const handleSaveKey = async () => {
    await updateSettings({ geminiApiKey: apiKeyInput.trim() });
    pushToast('Đã lưu Google Gemini API Key cục bộ trên thiết bị.', 'success');
  };

  const handleTestConnection = async () => {
    setTestingKey(true);
    setTestResult(null);
    try {
      await updateSettings({ geminiApiKey: apiKeyInput.trim() });
      const res = await testGeminiConnection(apiKeyInput.trim(), settings.geminiPrimaryModel);
      setTestResult({ ok: res.ok, msg: res.message });
      const patch: Partial<typeof settings> = {};
      if (res.availableModels && res.availableModels.length > 0) {
        patch.availableModels = res.availableModels;
      }
      if (res.ok && res.modelUsed) {
        patch.geminiPrimaryModel = res.modelUsed;
      } else if (res.recommendedPrimary) {
        patch.geminiPrimaryModel = res.recommendedPrimary;
      }
      if (res.recommendedLite) {
        patch.geminiLiteModel = res.recommendedLite;
      }
      if (Object.keys(patch).length > 0) {
        await updateSettings(patch);
      }
    } finally {
      setTestingKey(false);
    }
  };

  const handleFetchLatestModels = async () => {
    setFetchingModels(true);
    try {
      const models = await fetchAvailableGeminiModels(apiKeyInput.trim());
      await updateSettings({
        geminiApiKey: apiKeyInput.trim(),
        availableModels: models,
        geminiPrimaryModel: models[0] || settings.geminiPrimaryModel,
        geminiLiteModel:
          models.find((m) => m.includes('flash-lite')) ||
          models[1] ||
          models[0] ||
          settings.geminiLiteModel
      });
      pushToast(`Đã cập nhật ${models.length} model mới nhất từ Google AI Studio!`, 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Lỗi tải danh sách model', 'error');
    } finally {
      setFetchingModels(false);
    }
  };

  const handleImportFullDict = async () => {
    setFullDbProgress({ active: true, percent: 2, message: 'Đang khởi chạy Web Worker...' });
    try {
      const res = await importFullDatabaseViaWorker((p) => {
        setFullDbProgress({ active: p.type === 'PROGRESS', percent: p.percent, message: p.message });
      });
      invalidateDictionaryCache();
      invalidateHandwritingIndex();
      await updateSettings({ fullDictLoaded: true, fullDictCount: res.dictCount });
      await refreshStorage();
      pushToast(
        `Đã nạp xong ${res.dictCount.toLocaleString('vi-VN')} mục từ & ${res.graphicsCount.toLocaleString('vi-VN')} nét chữ!`,
        'success'
      );
    } catch (err) {
      setFullDbProgress({ active: false, percent: 0, message: '' });
      pushToast(err instanceof Error ? err.message : 'Lỗi nạp gói từ điển mở rộng', 'error');
    }
  };

  const handleClearAudioCache = async () => {
    const count = await clearAudioCache();
    await refreshStorage();
    pushToast(`Đã dọn ${count} tệp âm thanh cache (không ảnh hưởng dữ liệu học).`, 'success');
  };

  const handleExportBackup = async () => {
    try {
      const filename = await downloadOrShareBackup(includeKeyInBackup);
      pushToast(`Đã xuất tệp sao lưu ${filename}!`, 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Lỗi xuất sao lưu', 'error');
    }
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const res = await importBackupJson(text, importMode);
      await initApp();
      await refreshStorage();
      pushToast(
        `Khôi phục (${importMode === 'merge' ? 'Gộp thông minh' : 'Ghi đè'}) thành công: ${res.vocabCount} từ, ${res.lessonCount} bài khóa, ${res.examCount} đề thi!`,
        'success'
      );
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'Lỗi nhập tệp sao lưu', 'error');
    }
  };

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
        <Settings className="w-6 h-6 text-brand-600" />
        <span>Cài đặt Hệ thống, AI & Sao lưu</span>
      </h1>

      {/* 1. Giao diện & Lộ trình học */}
      <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
        <h2 className="text-base font-bold">1. Giao diện, Giáo trình HSK & Mục tiêu ngày</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Chế độ sáng / tối</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => updateSettings({ theme: 'light' })}
                className={`flex items-center justify-center gap-2 rounded-xl border py-2 text-xs font-bold ${
                  settings.theme === 'light'
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                <Sun className="w-4 h-4" /> Light Mode
              </button>
              <button
                type="button"
                onClick={() => updateSettings({ theme: 'dark' })}
                className={`flex items-center justify-center gap-2 rounded-xl border py-2 text-xs font-bold ${
                  settings.theme === 'dark'
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                <Moon className="w-4 h-4" /> Dark Mode
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">Hệ chuẩn HSK</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => updateSettings({ hskStandard: 'hsk2' })}
                className={`rounded-xl border py-2 text-xs font-bold ${
                  settings.hskStandard === 'hsk2'
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                HSK 2.0 (Cấp 1–6)
              </button>
              <button
                type="button"
                onClick={() => updateSettings({ hskStandard: 'hsk3' })}
                className={`rounded-xl border py-2 text-xs font-bold ${
                  settings.hskStandard === 'hsk3'
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                HSK 3.0 (Cấp 1–9)
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">
              Cấp độ HSK mặc định (đồng bộ Hôm nay, Trò chơi &amp; Gia sư AI)
            </label>
            <select
              value={settings.targetHskLevel}
              onChange={(e) => updateSettings({ targetHskLevel: Number(e.target.value) })}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-bold"
            >
              {Array.from(
                { length: settings.hskStandard === 'hsk3' ? 9 : 6 },
                (_, i) => i + 1
              ).map((lv) => (
                <option key={lv} value={lv}>
                  {settings.hskStandard === 'hsk3' ? `HSK 3.0 · Cấp ${lv}` : `HSK ${lv}`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex justify-between text-xs font-semibold text-slate-500 mb-1.5">
              <span>Mục tiêu số từ mỗi ngày</span>
              <span className="text-brand-600 font-bold">{settings.dailyWordGoal} từ / ngày</span>
            </div>
            <input
              type="range"
              min={5}
              max={50}
              step={5}
              value={settings.dailyWordGoal}
              onChange={(e) => updateSettings({ dailyWordGoal: Number(e.target.value) })}
              className="w-full accent-brand-600"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs font-medium cursor-pointer pt-1">
          <input
            type="checkbox"
            checked={defaultHideInPractice}
            onChange={(e) => setDefaultHideInPractice(e.target.checked)}
            className="rounded text-brand-600"
          />
          <span>
            Bật Anti-Crutch: Ẩn mặc định Pinyin & Dịch nghĩa khi vào ôn tập / chơi Memory Arcade
          </span>
        </label>
      </section>

      {/* 2. Google Gemini API (BYOK) — Model mới nhất */}
      <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-brand-600" />
            <span>2. Google Gemini API Miễn phí (BYOK)</span>
          </h2>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800">
            Đã gọi AI hôm nay: <strong>{settings.dailyAiCallCount}</strong> lượt
          </span>
        </div>

        <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 p-3.5 text-xs space-y-1 text-slate-600 dark:text-slate-300">
          <div className="font-bold text-slate-900 dark:text-white">
            Hướng dẫn 3 bước lấy API Key miễn phí 0đ từ Google AI Studio:
          </div>
          <ol className="list-decimal pl-4 space-y-0.5">
            <li>
              Mở{' '}
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-brand-600 underline font-semibold"
              >
                aistudio.google.com/apikey
              </a>{' '}
              và đăng nhập tài khoản Google.
            </li>
            <li>Bấm <strong>"Create API key"</strong> → sao chép chuỗi bắt đầu bằng <code>AIzaSy...</code></li>
            <li>Dán vào ô bên dưới, bấm <strong>"Lưu"</strong> rồi bấm <strong>"Tải danh sách model mới nhất"</strong>.</li>
          </ol>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="password"
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            placeholder="Dán Google Gemini API Key (AIzaSy...)..."
            className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm"
          />
          <button
            type="button"
            onClick={handleSaveKey}
            className="rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2 text-xs font-bold"
          >
            Lưu Key
          </button>
          <button
            type="button"
            disabled={testingKey}
            onClick={handleTestConnection}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 text-xs font-bold disabled:opacity-50"
          >
            {testingKey ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            <span>Kiểm tra kết nối</span>
          </button>
        </div>

        {testResult && (
          <div
            className={`rounded-xl px-3.5 py-2 text-xs font-semibold ${
              testResult.ok
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
            }`}
          >
            {testResult.msg}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">
              Model chính (Bài khóa, Giải đề, Phân tích từ, OCR)
            </label>
            <select
              value={settings.geminiPrimaryModel}
              onChange={(e) => updateSettings({ geminiPrimaryModel: e.target.value })}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-mono font-semibold"
            >
              {settings.availableModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">
              Model nhẹ / tốc độ cao (Chiết tự, Vẽ tay AI, STT Audio)
            </label>
            <select
              value={settings.geminiLiteModel}
              onChange={(e) => updateSettings({ geminiLiteModel: e.target.value })}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-mono font-semibold"
            >
              {settings.availableModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="button"
          disabled={fetchingModels || !apiKeyInput.trim()}
          onClick={handleFetchLatestModels}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-brand-500 px-3.5 py-2 text-xs font-bold disabled:opacity-40"
        >
          {fetchingModels ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          <span>Tải danh sách model mới nhất từ Google AI Studio</span>
        </button>
      </section>

      {/* 3. Giọng nói TTS 0đ */}
      <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
        <h2 className="text-base font-bold flex items-center gap-2">
          <Volume2 className="w-5 h-5 text-brand-600" />
          <span>3. Giọng đọc tiếng Trung 0đ (Microsoft Edge TTS + Offline Fallback)</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <label className="block font-semibold text-slate-500 mb-1">Giọng đọc zh-CN</label>
            <select
              value={settings.ttsVoice}
              onChange={(e) => updateSettings({ ttsVoice: e.target.value })}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-semibold"
            >
              {EDGE_CHINESE_VOICES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex justify-between font-semibold text-slate-500 mb-1">
              <span>Tốc độ đọc mặc định</span>
              <span className="text-brand-600 font-bold">{settings.ttsRate.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min={0.6}
              max={1.2}
              step={0.05}
              value={settings.ttsRate}
              onChange={(e) => updateSettings({ ttsRate: Number(e.target.value) })}
              className="w-full accent-brand-600"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-500 mb-1">
              Giới hạn cache âm thanh LRU (MB)
            </label>
            <input
              type="number"
              min={10}
              max={500}
              value={settings.maxAudioCacheMB}
              onChange={(e) => updateSettings({ maxAudioCacheMB: Number(e.target.value) || 50 })}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 font-semibold"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-500 mb-1">
              URL Proxy Edge TTS (Tùy chọn cho bản Web tĩnh)
            </label>
            <input
              type="url"
              value={settings.ttsProxyUrl}
              onChange={(e) => updateSettings({ ttsProxyUrl: e.target.value })}
              placeholder="Để trống khi dùng bản Windows .exe hoặc Android .apk"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => speakChinese('你好，欢迎使用汉智大师学习中文！').catch(() => {})}
          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-brand-50 px-3.5 py-2 text-xs font-bold"
        >
          <Volume2 className="w-4 h-4 text-brand-600" /> Nghe thử giọng đọc hiện tại
        </button>
      </section>

      {/* 4. Kho Từ điển Mở rộng & Quản lý Bộ nhớ Offline */}
      <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-brand-600" />
            <span>4. Quản lý Bộ nhớ Offline & Kho Từ điển Mở rộng</span>
          </h2>
          <button
            type="button"
            onClick={refreshStorage}
            className="text-xs font-semibold text-brand-600 hover:underline"
          >
            Làm mới
          </button>
        </div>

        {storage && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 p-3">
              <div className="text-slate-400">Từ điển & Nét chữ</div>
              <div className="text-base font-extrabold mt-0.5">
                {formatBytes(storage.dictionaryBytes)}
              </div>
              <div className="text-[11px] text-slate-500">
                {storage.dictionaryCount.toLocaleString('vi-VN')} từ ·{' '}
                {storage.graphicsCount.toLocaleString('vi-VN')} nét
              </div>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 p-3">
              <div className="text-slate-400">AI Cache vĩnh viễn</div>
              <div className="text-base font-extrabold mt-0.5">
                {formatBytes(storage.aiCacheBytes)}
              </div>
              <div className="text-[11px] text-slate-500">{storage.aiCacheCount} mục cache</div>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 p-3">
              <div className="text-slate-400">Audio Cache TTS</div>
              <div className="text-base font-extrabold mt-0.5">
                {formatBytes(storage.audioCacheBytes)}
              </div>
              <div className="text-[11px] text-slate-500">{storage.audioCacheCount} tệp âm thanh</div>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 p-3">
              <div className="text-slate-400">Tiến độ & Bài học</div>
              <div className="text-base font-extrabold mt-0.5">
                {formatBytes(storage.userDataBytes)}
              </div>
              <div className="text-[11px] text-slate-500">{storage.userVocabCount} từ trong sổ</div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={fullDbProgress.active}
            onClick={handleImportFullDict}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-xs font-bold disabled:opacity-50"
          >
            {fullDbProgress.active ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Database className="w-4 h-4" />
            )}
            <span>
              {storage && storage.graphicsCount >= 5000
                ? 'Đã tích hợp sẵn kho Mở rộng (Bấm để đồng bộ lại nếu cần)'
                : 'Nạp / Đồng bộ kho Từ điển Mở rộng (>9.500 chữ)'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleClearAudioCache}
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 px-4 py-2 text-xs font-bold"
          >
            <Trash2 className="w-4 h-4" />
            <span>Dọn cache audio cũ (giữ nguyên dữ liệu học)</span>
          </button>
        </div>

        {fullDbProgress.active && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-semibold">
              <span>{fullDbProgress.message}</span>
              <span>{fullDbProgress.percent}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-indigo-600 transition-all"
                style={{ width: `${fullDbProgress.percent}%` }}
              />
            </div>
          </div>
        )}
      </section>

      {/* 5. Sao lưu & Khôi phục JSON (Chuyển Windows <-> Android) */}
      <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
        <div>
          <h2 className="text-base font-bold">5. Sao lưu & Khôi phục dữ liệu (.JSON)</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Chuyển toàn bộ sổ từ FSRS, bài khóa, tài liệu, đề thi và AI Cache qua lại giữa Windows
            và Android không cần tài khoản đám mây.
          </p>
        </div>

        <label className="flex items-start gap-2 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={includeKeyInBackup}
            onChange={(e) => setIncludeKeyInBackup(e.target.checked)}
            className="mt-0.5 rounded text-brand-600"
          />
          <span>
            Bao gồm cả Gemini API Key trong tệp xuất{' '}
            <strong className="text-amber-600">
              (Mặc định TẮT để bảo mật — chỉ bật khi bạn tự chuyển sang thiết bị cá nhân khác)
            </strong>
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="button"
            onClick={handleExportBackup}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 text-xs font-bold shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span>Xuất bản sao lưu (.JSON)</span>
          </button>

          <div className="flex items-center gap-2">
            <select
              value={importMode}
              onChange={(e) => setImportMode(e.target.value as 'merge' | 'overwrite')}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs font-semibold"
            >
              <option value="merge">Gộp thông minh (Merge giữ bản mới hơn)</option>
              <option value="overwrite">Ghi đè toàn bộ dữ liệu cũ</option>
            </select>

            <input
              ref={importFileRef}
              type="file"
              accept="application/json,.json"
              onChange={handleImportBackup}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => importFileRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 px-4 py-2 text-xs font-bold"
            >
              <Upload className="w-4 h-4" />
              <span>Nhập tệp .JSON</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
