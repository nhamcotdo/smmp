# 📄 FILE YÊU CẦU KỸ THUẬT (PRD) - DỰ ÁN SMMP (Social Media Management Platform)

## 1. Tổng quan dự án (Project Overview)

- **Tên dự án**: SMMP (Social Media Management Platform)
- **Mô tả**: Nền tảng quản lý mạng xã hội đa kênh (All-in-one), cho phép người dùng kết nối các tài khoản Facebook, Instagram, TikTok, YouTube, Zalo OA để lên lịch đăng bài, quản lý tương tác và xem báo cáo hiệu quả.
- **Mục tiêu (MVP)**:
    - Xác thực người dùng an toàn.
    - Kết nối tối thiểu 3 kênh: Threads.
    - Soạn thảo, lên lịch và đăng bài tự động.
    - Quản lý lịch đăng dạng Calendar.
    - Báo cáo thống kê cơ bản.
- **Ngôn ngữ lập trình**: TypeScript.
- **Framework**: Next.js (App Router).
- **Database**: PostgreSQL (Supabase), MongoDB (cho log/config linh hoạt).
- **Giao thức**: RESTful API.

---

## 2. Yêu cầu chi tiết theo Module (Functional Requirements)

### 2.1 Module Xác thực (Auth Service)

**Mô tả**: Xử lý đăng ký, đăng nhập và phân quyền người dùng.

| TÍNH NĂNG | CHI TIẾT YÊU CẦU | API ENDPOINT (ĐỀ XUẤT) | GHI CHÚ |
| --- | --- | --- | --- |
| **Đăng ký** | - Nhập Email, Mật khẩu.- Mật khẩu phải băm (hash) trước khi lưu (bcrypt).- Gửi email xác nhận (tùy chọn MVP). | **`POST /api/auth/register`** | Sử dụng Supabase Auth hoặc JWT tự xây dựng. |
| **Đăng nhập** | - Nhập Email/Mật khẩu.- Trả về Access Token và Refresh Token. | **`POST /api/auth/login`** | Token lưu trong HttpOnly Cookie. |
| **Đăng nhập Social** | - Hỗ trợ đăng nhập qua Google và Facebook. | **`GET /api/auth/google`**, **`GET /api/auth/facebook`** | Sử dụng OAuth2. |
| **Phân quyền** | - Vai trò: **Admin**, **Editor** (đăng bài), **Viewer** (chỉ xem).- Middleware kiểm tra quyền truy cập các route nhạy cảm. | Middleware | RBAC (Role-Based Access Control). |
| **Quên mật khẩu** | - Nhập Email -> Gửi link reset qua Email. | **`POST /api/auth/forgot-password`** |  |

### 2.2 Module Quản lý Kênh (Channel Service)

**Mô tả**: Kết nối và quản lý các tài khoản mạng xã hội của người dùng.

| TÍNH NĂNG | CHI TIẾT YÊU CẦU | API ENDPOINT | GHI CHÚ |
| --- | --- | --- | --- |
| **Kết nối kênh** | - Người dùng nhấn "Kết nối" -> Redirect sang trang xác thực của mạng xã hội (OAuth).- Nhận **`Access Token`** và **`Refresh Token`** từ MXH -> Lưu vào DB (mã hóa). | **`POST /api/channels/connect`** | Bắt buộc mã hóa token khi lưu DB. |
| **Danh sách kênh** | - Hiển thị danh sách kênh đã kết nối (Avatar, Tên, Platform, Trạng thái Active/Expired). | **`GET /api/channels`** |  |
| **Ngắt kết nối** | - Xóa token và thông tin kênh khỏi hệ thống. | **`DELETE /api/channels/:id`** | Soft delete (đánh dấu xóa). |
| **Làm mới Token** | - Background job kiểm tra và làm mới Access Token nếu hết hạn (dùng Refresh Token). | **`POST /api/channels/refresh-token`** | Dùng agenda hoặc bull-queue. |

**Platform hỗ trợ (MVP)**:

1. **Threads**

### 2.3 Module Nội dung & Lên lịch (Content & Scheduler Service)

**Mô tả**: Tạo bài viết và lên lịch đăng tự động.

| TÍNH NĂNG | CHI TIẾT YÊU CẦU | API ENDPOINT | GHI CHÚ |
| --- | --- | --- | --- |
| **Soạn thảo bài viết** | - Tạo bài viết mới với: Content (text), Media (ảnh/video), Channels (chọn nhiều kênh để đăng cùng lúc). | **`POST /api/posts`** | Upload ảnh/video lên Cloudinary/S3 trước. |
| **Tùy chỉnh nền tảng** | - Cho phép chỉnh sửa content/tương tác riêng cho từng nền tảng (ví dụ: thêm hashtag riêng cho Threads). | **`PATCH /api/posts/:id`** |  |
| **Lên lịch đăng** | - Chọn thời gian đăng cụ thể (Date time).- Lưu trạng thái bài: **`SCHEDULED`**. | **`POST /api/posts/:id/schedule`** |  |
| **Xử lý đăng tự động** | - Cron job chạy mỗi 5 phút.- Tìm bài **`SCHEDULED`** có thời gian <= Hiện tại.- Gọi API tương ứng của Threads/Facebook/TikTok/Zalo để đăng.- Cập nhật trạng thái bài: **`PUBLISHED`** hoặc **`FAILED`**. | Internal Worker | Ghi lại log lỗi nếu đăng thất bại. |
| **Nháp & Kho nội dung** | - Lưu bài nháp không cần lịch.- Chức năng "Clone" bài cũ. | **`GET /api/posts?status=draft`** |  |

### 2.4 Module Lịch & Quản lý (Calendar Service)

**Mô tả**: Hiển thị lịch đăng bài trực quan.

| TÍNH NĂNG | CHI TIẾT YÊU CẦU | API ENDPOINT | GHI CHÚ |
| --- | --- | --- | --- |
| **View Lịch (Calendar)** | - Hiển thị bài đăng dưới dạng lịch tháng/tuần.- Màu sắc khác nhau cho từng trạng thái (Đã đăng, Lên lịch, Lỗi). | **`GET /api/posts?start_date=...&end_date=...`** | Frontend dùng library: **`FullCalendar`** hoặc **`BigCalendar`**. |
| **Kéo thả (Drag & Drop)** | - Cho phép kéo bài viết từ ngày này sang ngày khác để đổi lịch. | **`PATCH /api/posts/:id/reschedule`** | Cập nhật thời gian trong DB. |

### 2.5 Module Báo cáo (Analytics Service)

**Mô tả**: Thống kê hiệu quả bài viết và kênh.

| TÍNH NĂNG | CHI TIẾT YÊU CẦU | API ENDPOINT | GHI CHÚ |
| --- | --- | --- | --- |
| **Thống kê tổng quan** | - Tổng lượt xem, tiếp cận, tương tác của toàn bộ kênh trong 30 ngày qua. | **`GET /api/analytics/overview`** | Aggregation query trong MongoDB/Postgres. |
| **Chi tiết bài viết** | - Hiển thị metrics của từng bài (Like, Share, Comment). | **`GET /api/analytics/posts/:id`** | Lấy số liệu thực tế từ API của MXH (không cache quá 1 tiếng). |
| **Xuất báo cáo** | - Xuất file CSV/PDF báo cáo tháng. | **`GET /api/analytics/export`** | Dùng thư viện **`pdfkit`** hoặc **`csv-writer`**. |

---

## 3. Thiết kế Database (Database Schema)

### 3.1 PostgreSQL (Relational Data)

**Table: `users`**

- **`id`**: UUID (Primary Key)
- **`email`**: String (Unique)
- **`password_hash`**: String
- **`role`**: Enum ('admin', 'editor', 'viewer')
- **`created_at`**: Timestamp

**Table: `social_accounts`**

- **`id`**: UUID (Primary Key)
- **`user_id`**: UUID (Foreign Key -> users.id)
- **`platform`**: Enum ('facebook', 'tiktok', 'zalo')
- **`platform_id`**: String (ID của page/tiktok account)
- **`name`**: String (Tên hiển thị)
- **`access_token`**: Text (Encrypted)
- **`refresh_token`**: Text (Encrypted)
- **`token_expires_at`**: Timestamp
- **`avatar_url`**: String

**Table: `posts`**

- **`id`**: UUID (Primary Key)
- **`user_id`**: UUID (Foreign Key)
- **`content`**: Text
- **`media_urls`**: JSON/Array (List đường dẫn ảnh/video)
- **`status`**: Enum ('draft', 'scheduled', 'published', 'failed')
- **`scheduled_at`**: Timestamp
- **`published_at`**: Timestamp
- **`platform_specifics`**: JSONB (Lưu config riêng cho từng nền tảng)

**Table: `post_platform_logs`**

- **`id`**: UUID
- **`post_id`**: UUID
- **`platform`**: Enum
- **`external_post_id`**: String (ID bài viết trên MXH gốc)
- **`status`**: Enum
- **`error_message`**: Text

### 3.2 MongoDB (NoSQL Data - Optional but Recommended)

**Collection: `analytics_cache`**

json

{

"_id": ObjectId,

"post_id": UUID,

"platform": "facebook",

"metrics": {

"likes": 120,

"comments": 45,

"shares": 10,

"impressions": 5000

},

"fetched_at": ISODate

}

---

## 4. Yêu cầu Phi chức năng (Non-Functional Requirements)

1. **Bảo mật (Security)**:
    - Mọi API phải xác thực qua JWT Token (trừ endpoint **`/auth/login`**, **`/register`**).
    - Mật khẩu phải hash bằng **bcrypt** (cost >= 10).
    - Access Token của mạng xã hội (Facebook/TikTok) **phải mã hóa (AES-256)** trước khi lưu vào Database.
    - Sử dụng HTTPS (TLS 1.3) cho mọi giao tiếp.
2. **Hiệu suất (Performance)**:
    - API phản hồi trong vòng **< 200ms** (trừ API gọi tới bên thứ 3).
    - Hệ thống xử lý đăng bài không được chặn giao diện người dùng (dùng **Queue/Message Broker** như Redis/Bull).
3. **Tính sẵn sàng (Availability)**:
    - Uptime target: 99.5%.
    - Tự động restart nếu service crashed (sử dụng Docker/PM2).
4. **UX/UI**:
    - Responsive: Hoạt động tốt trên Mobile, Tablet, Desktop.
    - Dark mode support (tùy chọn).
    - Feedback: Hiển thị Loading spinner khi đang xử lý, Toast message khi thành công/lỗi.