# HƯỚNG DẪN THIẾT KẾ & TRIỂN KHAI HỆ THỐNG MULTI-TENANT TRÊN CLOUDFLARE (CÁCH 1)

> **Mục tiêu:** Lưu trữ và đồng bộ hóa toàn bộ dữ liệu phân công chuyên môn, giáo viên, thời khóa biểu của từng trường học một cách độc lập (Tenant Isolation), miễn phí 100%, bảo mật tuyệt đối và không phụ thuộc vào liên kết xem trước Google Cloud Run nội bộ.

---

## I. GIẢI ĐÁP CÁC THẮC MẮC THEN CHỐT

### 1. Cách 1 có dùng được cho nhiều trường không?
**HOÀN TOÀN DÙNG ĐƯỢC VÀ KHÔNG GIỚI HẠN SỐ TRƯỜNG!**
* **Cơ chế Multi-Tenant:** Mỗi trường học khi tham gia hệ thống được định danh bởi một mã duy nhất (`schoolId`, ví dụ: `school_quyhop`, `school_himlam`, `school_c3_nguyentrai`, v.v.).
* Trên Cloudflare KV, dữ liệu được phân vùng theo khóa:
  - `tenant_data:<schoolId>`: Chứa toàn bộ giáo viên, môn học, lớp, phân công, tổ bộ môn, điểm trường, phiên bản TKB của trường đó.
  - `tenant_meta:<schoolId>`: Chứa tên trường, số lượng giáo viên, số lớp học và thời gian cập nhật gần nhất.
* **1 Cloudflare Worker duy nhất** có thể phục vụ đồng thời hàng trăm, hàng ngàn trường học mà **không bao giờ bị trùng lặp hoặc lộ chéo dữ liệu**.

### 2. Có mất phí không?
**HOÀN TOÀN MIỄN PHÍ 100% VĨNH VIỄN (Gói Cloudflare Free Tier):**
* **Cloudflare Pages (Lưu trữ Web Frontend):** Miễn phí vĩnh viễn, **băng thông không giới hạn (Unlimited Bandwidth)**, hỗ trợ gắn tên miền riêng miễn phí, SSL/TLS tự động miễn phí.
* **Cloudflare Workers (Máy chủ Serverless API):** Miễn phí **100.000 requests/ngày** (dư sức cho hàng chục nghìn lượt truy cập và lưu trữ phân công mỗi ngày).
* **Cloudflare KV (Key-Value Storage):** Miễn phí **1 GB dung lượng** (mỗi trường học chỉ chiếm khoảng 100 KB - 500 KB JSON, 1 GB đủ chứa từ 2.000 đến 10.000 trường học), **100.000 lượt đọc/ngày** và **1.000 lượt ghi/ngày**.

### 3. Có an toàn không?
**CỰC KỲ AN TOÀN - TIÊU CHUẨN DOANH NGHIỆP QUỐC TẾ:**
* **Bảo vệ toàn diện bởi Cloudflare:** Mạng lưới bảo mật lớn nhất thế giới, tự động lọc bot xấu, chống tấn công DDoS, mã hóa đường truyền HTTPS/TLS 1.3.
* **Cô lập dữ liệu tuyệt đối (Tenant Isolation):** Mỗi trường chỉ truy cập và thao tác đúng phân vùng `schoolId` của mình.
* **Khóa bảo mật `SECRET_API_KEY` (Tùy chọn):** Quản trị viên có thể cài một mã bí mật trên Worker, chỉ những ứng dụng có mã này gửi kèm qua Header `X-API-KEY` mới được phép ghi/đọc dữ liệu.
* **Không phụ thuộc tài khoản Google cá nhân:** Link truy cập công khai hoặc tên miền riêng của trường mở được trên mọi máy tính, điện thoại, trình duyệt (Chrome, Cốc Cốc, Edge, Safari, Firefox), không bao giờ bị lỗi `403 Forbidden` hay `404 Page not found`.

---

## II. QUY TRÌNH THIẾT KẾ VÀ TRIỂN KHAI (5 BƯỚC HOÀN TẤT TRONG 5 PHÚT)

### BƯỚC 1: Đăng ký tài khoản Cloudflare
1. Truy cập: [https://dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up)
2. Nhập Email và Mật khẩu của bạn, nhấn **Create Account**. Không cần khai báo thẻ ngân hàng hay visa.

---

### BƯỚC 2: Mở mục KV (Storage) và tạo KV Namespace
Do Cloudflare vừa cập nhật giao diện mới, mục **KV** nằm ở phần Lưu trữ. Thầy/Cô có thể vào bằng 1 trong các cách cực nhanh sau:
* **Cách 1 (Nhanh nhất):** Nhấp vào ô tìm kiếm **"Quick search... (Ctrl + K)"** ở góc trên bên trái màn hình → gõ chữ `KV` → Chọn **Workers KV** (hoặc **KV Namespaces**).
* **Cách 2 (Trên menu trái):** Ở cột menu bên trái, cuộn chuột xuống phía dưới phần **Compute** sẽ thấy mục **Storage & Databases** (hoặc **Storage**) → Nhấp vào **KV**.
* **Cách 3 (Mở trực tiếp link):** Nhấp trực tiếp vào đường link sau trong trình duyệt:
  `https://dash.cloudflare.com/workers/kv/namespaces`

Sau khi vào trang KV:
1. Nhấn nút màu xanh **Create a namespace** (hoặc **Create namespace**).
2. Tại ô **Namespace Name**, nhập chính xác:
   ```text
   SCHOOL_TENANTS
   ```
3. Nhấn **Add**. Bạn sẽ thấy vùng lưu trữ `SCHOOL_TENANTS` xuất hiện trong danh sách.

---

### BƯỚC 3: Tạo Cloudflare Worker Backend
1. Tại menu trái, chọn **Workers & Pages** -> chọn **Create application**.
2. Chọn tab **Workers**, nhấn nút **Create Worker**.
3. Đặt tên cho Worker (ví dụ: `pccm-backend`), sau đó nhấn **Deploy**.

---

### BƯỚC 4: Dán mã nguồn Worker & Liên kết KV Namespace
1. Ngay tại trang Worker vừa tạo, nhấn nút **Edit code** (Chỉnh sửa mã).
2. Xóa toàn bộ nội dung mã mẫu có sẵn trong khung soạn thảo.
3. Mở file `cloudflare-worker/worker.js` trong thư mục dự án (hoặc nhấn nút **Sao chép mã nguồn Worker** trong phần mềm), sao chép toàn bộ mã nguồn và dán vào.
4. Nhấn **Deploy** (Góc trên bên phải) để lưu lại code.
5. Quay lại trang cấu hình Worker:
   - Nhấp vào tab **Settings** -> chọn mục **Variables and Secrets** (hoặc **Variables**).
   - Kéo xuống phần **KV Namespace Bindings**, nhấn **Add binding**.
   - Tại ô **Variable name**, nhập chính xác: `SCHOOL_TENANTS`
   - Tại ô **KV namespace**, chọn `SCHOOL_TENANTS` (đã tạo ở Bước 2).
   - Nhấn **Save and Deploy**.

*(Tùy chọn tăng cường bảo mật)*: Tại mục **Environment Variables**, bạn có thể bấm **Add variable**, đặt tên biến là `SECRET_API_KEY` và giá trị là một chuỗi ký tự bất kỳ để bảo vệ Worker.

---

### BƯỚC 5: Lấy Worker URL và sử dụng trong Ứng dụng
1. Copy đường dẫn URL của Worker vừa tạo. Địa chỉ sẽ có dạng:
   ```text
   https://pccm-backend.<ten-subdomain-cua-ban>.workers.dev
   ```
2. Mở phần mềm PCCM:
   - Bấm vào menu **Đồng bộ Đám mây** (hoặc biểu tượng Đám mây Cloud ở góc trên).
   - Chuyển sang tab **Lưu trữ Cloudflare (Mỗi trường 1 Tenant)**.
   - Dán URL vừa copy vào ô **Cloudflare Worker URL**.
   - (Nếu có đặt `SECRET_API_KEY`, nhập mã vào ô API Key).
   - Nhấn **Kiểm tra kết nối & Lưu cấu hình**.
3. Bạn sẽ nhận được thông báo xanh: *“Kết nối máy chủ Cloudflare Worker thành công 100%!”*.
4. Giờ đây, chỉ cần nhấn:
   - **Đẩy lên Cloudflare KV ngay**: Toàn bộ dữ liệu của trường sẽ được sao lưu an toàn lên Cloudflare.
   - **Kéo dữ liệu về máy**: Bất kỳ máy tính nào của giáo viên trong trường nhập mã trường đều có thể kéo dữ liệu mới nhất về sử dụng.

---

## III. HƯỚNG DẪN ĐƯA TOÀN BỘ WEB LÊN CLOUDFLARE PAGES & GẮN TÊN MIỀN RIÊNG

Nếu nhà trường muốn sở hữu đường link Web chính thức (ví dụ: `phancong.thpt-nguyentrai.edu.vn` hoặc link `.pages.dev` vĩnh viễn):

1. **Build dự án thành file tĩnh:**
   - Chạy lệnh: `npm run build`
   - Thư mục đầu ra là `dist/`.
2. **Triển khai lên Cloudflare Pages:**
   - Vào Cloudflare Dashboard -> **Workers & Pages** -> **Create application** -> Tab **Pages**.
   - Chọn **Upload assets** (Tải thư mục lên), kéo thả toàn bộ thư mục `dist` vào và nhấn Deploy.
   - Bạn sẽ nhận được ngay một link web công khai siêu tốc độ: `https://ten-du-an.pages.dev`.
3. **Gắn Domain riêng của trường (Custom Domain):**
   - Vào dự án Pages vừa tạo -> chọn tab **Custom domains**.
   - Nhấn **Set up a custom domain**, điền tên miền phụ của trường (ví dụ: `pccm.thcs-quyhop.edu.vn`).
   - Làm theo hướng dẫn trỏ bản ghi CNAME là hoàn tất!

---

*Hệ thống được thiết kế độc lập, bảo mật và tương thích hoàn toàn với kiến trúc đa trường của VN-School PCCM.*
