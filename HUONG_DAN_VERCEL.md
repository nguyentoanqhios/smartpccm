# HƯỚNG DẪN XUẤT BẢN ỨNG DỤNG LÊN VERCEL (HOÀN TOÀN MIỄN PHÍ)

Ứng dụng **PHÂN CÔNG CHUYÊN MÔN** đã được cấu hình sẵn tệp `vercel.json` tối ưu hóa 100% cho Single Page Application (SPA), tự động điều hướng URL và kết nối trực tiếp đến cơ sở dữ liệu Cloud Firestore (`smartpccm`).

---

## CÁCH 1: TRIỂN KHAI QUA GITHUB (KHUYÊN DÙNG - ĐƠN GIẢN NHẤT)

### Bước 1: Đưa mã nguồn lên GitHub
1. Tải toàn bộ mã nguồn của dự án về máy tính hoặc đẩy lên tài khoản **GitHub** cá nhân của Thầy.
2. Tạo một kho lưu trữ (Repository) mới trên GitHub, ví dụ: `phan-cong-chuyen-mon`.
3. Đẩy toàn bộ mã nguồn lên repository này.

### Bước 2: Đăng nhập Vercel và liên kết
1. Truy cập trang chủ Vercel: **[https://vercel.com](https://vercel.com)**
2. Bấm nút **Sign Up** hoặc **Log In** -> Chọn **Continue with GitHub** (Đăng nhập bằng tài khoản GitHub để Vercel tự động liên kết).

### Bước 3: Tạo dự án mới (Import Project)
1. Tại bảng điều khiển Vercel Dashboard, bấm nút **"Add New..."** ở góc phải -> Chọn **"Project"**.
2. Trong danh sách kho lưu trữ GitHub hiện ra, tìm repository `phan-cong-chuyen-mon` và bấm **"Import"**.

### Bước 4: Kiểm tra cấu hình và Bấm Deploy
Vercel sẽ tự động đọc file `vercel.json` có sẵn trong mã nguồn:
* **Framework Preset**: `Vite` (tự động nhận diện)
* **Root Directory**: `./` (để nguyên mặc định)
* **Build Command**: `npm run build`
* **Output Directory**: `dist`
* **Environment Variables (Biến môi trường)**:
  * Cơ sở dữ liệu Cloud Firestore và Authentication (`smartpccm`) đã được thiết lập sẵn trong mã nguồn, **không bắt buộc phải nhập gì thêm**.
  * *(Tùy chọn)*: Nếu muốn dùng tính năng trợ lý AI Gemini, Thầy có thể thêm biến `GEMINI_API_KEY` với API key của Google.
3. Bấm nút **"Deploy"**.

Quá trình đóng gói và phát hành chỉ mất khoảng **30 - 60 giây**. Khi hoàn tất, màn hình sẽ hiện thông báo chúc mừng kèm theo tên miền chính thức của Thầy (Ví dụ: `https://phan-cong-chuyen-mon.vercel.app`).

---

## CÁCH 2: TRIỂN KHAI NHANH BẰNG DÒNG LỆNH (VERCEL CLI)

Nếu trên máy tính của Thầy đã cài đặt Node.js:
1. Mở cửa sổ dòng lệnh (Terminal / Command Prompt / PowerShell) tại thư mục mã nguồn.
2. Cài đặt Vercel CLI (nếu chưa có):
   ```bash
   npm install -g vercel
   ```
3. Chạy lệnh xuất bản bản chính thức (Production):
   ```bash
   vercel --prod
   ```
4. Đăng nhập theo hướng dẫn trên màn hình và bấm Enter để chọn các cấu hình mặc định. Vercel sẽ tự động tải lên và cấp link web ngay lập tức.

---

## BƯỚC CUỐI: CẤU HÌNH LIÊN KẾT VÀO HỆ THỐNG ĐỂ GỬI CÁC TRƯỜNG

Sau khi đã có link Vercel (ví dụ: `https://phan-cong-chuyen-mon.vercel.app`):
1. Thầy mở ứng dụng $\rightarrow$ Vào mục **Cấp quyền trường** (hoặc Quản lý bản quyền).
2. Tại thẻ của trường cần bàn giao, bấm **"Sao chép bàn giao"**.
3. Tại mục *Máy chủ phát hành liên kết*, bấm chọn **"Tự nhập Domain riêng (Gửi đối tác)"**.
4. Dán địa chỉ Vercel của Thầy vào (ví dụ: `https://phan-cong-chuyen-mon.vercel.app`).
5. Bấm nút **"Sao chép vào Clipboard"**.

Lúc này, toàn bộ thông tin đăng nhập và đường link công khai (kèm mã trường và mật khẩu riêng) sẽ được gửi cho đối tác. Giáo viên và hiệu trưởng các trường khác mở link trên máy tính hoặc điện thoại bất kỳ đều **vào được ngay lập tức 100%, không bao giờ bị lỗi 404 hay 403**.
