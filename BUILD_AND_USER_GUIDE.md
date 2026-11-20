# Hướng dẫn Sử dụng, Cài đặt & Đóng gói HanziMaster AI

**HanziMaster AI** là ứng dụng học tiếng Trung Giản thể All-in-One vận hành **Offline-First & 0đ phí server**, xây dựng từ một mã nguồn duy nhất (`React 18 + TypeScript + Tailwind CSS + Dexie IndexedDB`) đóng gói cho cả **Windows (`.exe`)** và **Android (`.apk`)**.

---

## 1. Cách chạy nhanh trên máy cá nhân (Web & Windows Desktop)

### Yêu cầu tối thiểu
- **Node.js 20+** (khuyên dùng Node 22/24).

### Các lệnh sử dụng
```bash
# 1. Cài đặt toàn bộ thư viện
npm install

# 2. Chạy chế độ Web Dev (mở http://localhost:5173 — đã tích hợp sẵn proxy Edge TTS 0đ!)
npm run dev

# 3. Chạy trực tiếp giao diện ứng dụng Windows Desktop (Electron)
npm run dev:electron

# 4. Kiểm tra TypeScript & chạy bộ Unit Test
npm run typecheck
npm test
```

> **Lưu ý trên Windows PowerShell:** Nếu PowerShell báo lỗi chính sách chạy script (`npm.ps1 cannot be loaded`), hãy dùng **Command Prompt (CMD)** hoặc gõ `npm.cmd run dev`.

---

## 2. Mở rộng Kho Từ điển Offline (>9.500 chữ MakeMeAHanzi + CC-CEDICT + HSK 1–6 & 3.0)

Ứng dụng đã **nhúng sẵn 520+ từ lõi HSK 1–3 chuẩn 100% tiếng Việt kèm 1.327 nét vẽ MakeMeAHanzi thật** và 2 đề thi mẫu HSK 1–3 nên mở lên là chạy mượt ngay không cần làm gì thêm.

Nếu muốn mở rộng lên **toàn bộ >9.500 chữ Hán, toàn bộ HSK 1–6 & HSK 3.0 và ~20.000+ mục từ CC-CEDICT offline**:
```bash
npm run build:dict
```
Sau khi script tải và biên dịch xong vào `public/data/`:
1. Mở ứng dụng → vào mục **Cài đặt** → mục **4. Quản lý Bộ nhớ Offline**.
2. Bấm **"Nạp gói Từ điển Mở rộng (>9.500 chữ qua Web Worker)"** và đợi thanh tiến trình chạy 100% (không làm đơ giao diện).

---

## 3. Cách lấy Google Gemini API Key miễn phí 0đ (Google AI Studio)

Mọi tính năng Offline (Từ điển, Vẽ tay nhận diện, Tập viết nét, FSRS, 7 Trò chơi Memory Arcade, 2 Đề mẫu HSK, Shadowing tự đối chiếu) đều chạy 100% không cần API Key.

Để mở khóa **Bài khóa tự sinh mỗi ngày**, **Gia sư AI đóng vai**, **Chấm đặt câu**, **Phân tích toàn bộ cách dùng từ**, **OCR ảnh/PDF** và **AI Giải đề HSK**:
1. Truy cập **[https://aistudio.google.com/apikey](https://aistudio.google.com/apikey)** và đăng nhập bằng tài khoản Google.
2. Bấm **"Create API key"** → sao chép chuỗi bắt đầu bằng `AIzaSy...`.
3. Mở **HanziMaster AI** → vào **Cài đặt** → dán key vào mục **2. Google Gemini API Miễn phí (BYOK)** → bấm **Lưu Key**.
4. Bấm **"Tải danh sách model mới nhất từ Google AI Studio"** (mặc định tối ưu với **`gemini-3.8-flash`** cho tác vụ chính và **`gemini-3.5-flash-lite`** cho tác vụ nhanh/nhẹ, tự động fallback nếu gặp giới hạn 429).
5. Bấm **"Kiểm tra kết nối"** để xác nhận.

> **Bảo mật & Tiết kiệm Quota:**
> - API Key chỉ lưu cục bộ trên máy của bạn (mã hóa Windows DPAPI trên bản Electron `.exe`).
> - Mọi kết quả AI (phân tích từ, bài khóa ngày, chiết tự, lời giải đề) đều được **lưu cache vĩnh viễn vào IndexedDB** để lần sau xem offline không tốn thêm lượt gọi.

---

## 4. Cách lấy file cài Windows (`.exe`) và Android (`.apk`) miễn phí qua GitHub Actions

Bạn **không cần máy tính mạnh hay cài Android Studio nặng hàng chục GB**:
1. Tạo 1 kho mã nguồn (repository) trên GitHub (Public hoặc Private đều được) và đẩy toàn bộ thư mục dự án lên nhánh `main`.
2. Vào tab **Actions** trên GitHub → chọn workflow **"Build HanziMaster AI (Windows .exe & Android .apk)"** (tự động chạy ngay khi push, hoặc bấm **Run workflow**).
3. Sau khoảng 5–8 phút build xong, kéo xuống cuối trang của lần chạy (mục **Artifacts**) và tải về:
   - **`HanziMaster-Windows-exe`**: Chứa cả **`HanziMaster-AI-Setup.exe`** (bộ cài đặt) và **`HanziMaster-AI-Portable.exe`** (chạy ngay không cần cài).
     *(Lưu ý: Do file cá nhân chưa mua chứng chỉ EV trả phí, Windows SmartScreen có thể hỏi 1 lần — chọn **More info → Run anyway**).*
   - **`HanziMaster-Android-apk`**: Chứa **`app-release.apk`** / **`HanziMaster-AI-debug.apk`** — chép sang điện thoại Android và bấm cài đặt trực tiếp (bật "Cho phép cài ứng dụng từ nguồn này").

### Ký chuẩn phát hành Release APK (tùy chọn)
Nếu bạn muốn tự ký release bằng Keystore riêng trong GitHub Actions, thêm 4 biến vào **Settings → Secrets and variables → Actions**:
- `ANDROID_KEYSTORE_BASE64` (file `.jks` mã hóa Base64)
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

### Hoặc đóng gói trực tiếp tại máy cá nhân
- **Xuất Windows `.exe`:**
  ```bash
  npm run build:win
  ```
  File xuất nằm trong thư mục `release/`.
- **Đóng gói Android `.apk` (cần JDK 21 & Android SDK):**
  ```bash
  npx cap add android        # Chỉ chạy lần đầu
  npm run build:android
  cd android && ./gradlew assembleDebug
  ```

---

## 5. Phím tắt Desktop & Đồng bộ dữ liệu giữa Windows và Android

- **Phím tắt trên Windows / Web Desktop:**
  - `Ctrl + K`: Mở hộp Tra từ nhanh `< 50ms`
  - `Ctrl + P`: Ẩn / Hiện Pinyin toàn ứng dụng
  - `Ctrl + M`: Ẩn / Hiện Dịch nghĩa toàn ứng dụng
  - Nút **Split-View** trên thanh tiêu đề: Chia đôi màn hình mở song song Từ điển / Luyện viết bên phải khi học Bài khóa, Chat AI hoặc Làm đề bên trái.
- **Chuyển dữ liệu học giữa Windows ↔ Android:**
  - Vào **Cài đặt → 5. Sao lưu & Khôi phục dữ liệu (.JSON)** → bấm **Xuất bản sao lưu (.JSON)** (mặc định không kèm API Key để an toàn).
  - Gửi file `.json` sang thiết bị kia → chọn chế độ **"Gộp thông minh (Merge giữ bản mới hơn)"** → bấm **Nhập tệp .JSON**.
