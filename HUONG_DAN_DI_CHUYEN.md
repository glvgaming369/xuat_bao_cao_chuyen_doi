# Hướng dẫn di chuyển Tool Xuất Báo Cáo sang máy tính khác

Tài liệu này hướng dẫn bạn các bước chi tiết để sao chép, cài đặt và vận hành công cụ này trên một máy tính mới.

---

## 📋 Yêu cầu trên máy tính mới

Trước khi bắt đầu, hãy đảm bảo máy tính mới đã cài đặt các phần mềm sau:
1. **Node.js**: Phiên bản tối thiểu v16.x trở lên. 
   - Tải về tại: [https://nodejs.org/](https://nodejs.org/) (Chọn bản LTS).
2. **GPM Login v3**: Phần mềm GPM Login đang chạy.
   - Hãy chắc chắn rằng cổng API trong phần cài đặt của GPM Login đang để mặc định là `19995` (nếu đổi cổng khác, bạn cần sửa biến `PORT` hoặc `GPM_API_BASE` ở dòng 9 trong file `server.js`).

---

## 🚀 Các bước di chuyển và chạy Tool

### Bước 1: Sao chép thư mục code sang máy mới
Bạn hãy nén và copy toàn bộ thư mục `xuat_bao_cao_chuyen_doi` sang máy mới.
> [!TIP]
> Để quá trình copy nhanh hơn, bạn **không cần copy** thư mục `node_modules` và thư mục `downloads` sang máy mới. Các thư mục này sẽ tự động được tải lại hoặc tạo mới sau đó.

### Bước 2: Cài đặt thư viện trên máy mới
1. Mở cửa sổ **Terminal** (hoặc Command Prompt / PowerShell) tại thư mục dự án trên máy mới.
2. Chạy lệnh sau để tự động tải về các thư viện cần thiết (`patchright`, `express`, `axios`):
   ```bash
   npm install
   ```

### Bước 3: Cấu hình Profile ID mới
1. Mở phần mềm GPM Login trên máy mới, lấy ID của các profile cần chạy.
2. Mở file [id.txt](id.txt) trong thư mục dự án và dán các ID profile mới vào (mỗi dòng một ID).

### Bước 4: Khởi chạy công cụ
Chạy lệnh sau tại Terminal để khởi động server giao diện:
```bash
npm start
```
*(Hoặc lệnh: `node server.js`)*

Sau khi màn hình hiện thông báo `SERVER ĐÃ CHẠY TẠI ĐỊA CHỈ: http://localhost:3000`, bạn hãy mở trình duyệt web và truy cập vào **[http://localhost:3000](http://localhost:3000)** để sử dụng bình thường.
