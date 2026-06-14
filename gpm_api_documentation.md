# Hướng dẫn Sử dụng API GPM Login để Điều khiển Chrome

Tài liệu này hướng dẫn chi tiết cách sử dụng hệ thống API của **GPM Login (v3)** để quản lý, tạo mới, cấu hình proxy và khởi chạy các profile trình duyệt Chrome (Chromium) phục vụ cho việc tự động hóa (Automation).

> [!NOTE]
> Địa chỉ API mặc định thường chạy ở localhost: `http://127.0.0.1:19995`. Bạn có thể kiểm tra hoặc thay đổi cổng này trong phần cài đặt của phần mềm GPM Login.

---

## 1. Lấy danh sách Profiles

Lấy danh sách tất cả các profile trình duyệt hiện có trong GPM Login.

* **API URL:** `GET /api/v3/profiles`
* **Tham số (Query Params):**

| Tên Param | Bắt buộc | Mặc định | Mô tả |
| :--- | :---: | :---: | :--- |
| `group_id` | Không | - | Lọc profile theo ID nhóm (lấy từ API Danh sách nhóm). |
| `page` | Không | `1` | Số thứ tự trang cần lấy. |
| `per_page`| Không | `50` | Số lượng profile hiển thị trên mỗi trang. |
| `sort` | Không | `0` | Tiêu chí sắp xếp:<br>`0`: Mới nhất<br>`1`: Cũ đến mới<br>`2`: Tên A-Z<br>`3`: Tên Z-A |
| `search` | Không | - | Tìm kiếm profile theo tên (từ khóa). |

* **Ví dụ Request:**
  ```http
  GET http://127.0.0.1:19995/api/v3/profiles?group_id=1&page=1&per_page=100&sort=0
  ```

* **Phản hồi (Response) thành công:**
  ```json
  {
      "success": true,
      "data": [
          {
              "id": "929e187c-2da7-4ecb-b3dd-9600e211fa4f",
              "name": "Ebay Account 01",
              "raw_proxy": "127.0.0.1:1080",
              "browser_type": "chromium",
              "browser_version": "119.0.6045.124",
              "group_id": "1",
              "profile_path": "Local",
              "note": "Tài khoản phụ",
              "created_at": "2023-12-04T21:33:37Z"
          }
      ],
      "pagination": {
          "total": 7,
          "page": 1,
          "page_size": 100,
          "total_page": 1
      },
      "message": "OK"
  }
  ```

---

## 2. Lấy thông tin chi tiết một Profile

Lấy thông tin cấu hình chi tiết của một profile cụ thể theo ID.

* **API URL:** `GET /api/v3/profiles/{id}`
* **Ví dụ Request:**
  ```http
  GET http://127.0.0.1:19995/api/v3/profiles/929e187c-2da7-4ecb-b3dd-9600e211fa4f
  ```

* **Phản hồi (Response) thành công:**
  ```json
  {
      "success": true,
      "data": {
          "id": "929e187c-2da7-4ecb-b3dd-9600e211fa4f",
          "name": "Ebay Account 01",
          "raw_proxy": "127.0.0.1:1080",
          "browser_type": "chromium",
          "browser_version": "119.0.6045.124",
          "group_id": "1",
          "profile_path": "Local",
          "note": "Tài khoản phụ",
          "created_at": "2023-12-04T21:33:37Z"
      },
      "message": "OK"
  }
  ```

---

## 3. Tạo mới Profile

Tạo một profile Chrome mới với các cấu hình vân tay trình duyệt (fingerprint), hệ điều hành và proxy được cá nhân hóa.

* **API URL:** `POST /api/v3/profiles/create`
* **Dữ liệu gửi lên (JSON Body):**

| Trường | Bắt buộc | Mặc định | Mô tả |
| :--- | :---: | :---: | :--- |
| `profile_name` | **Có** | - | Tên hiển thị của profile. |
| `group_name` | Không | `"All"` | Tên nhóm muốn gán cho profile. |
| `browser_name` | Không | `"Chrome"` | Tên trình duyệt (`Chrome`, `Firefox`). |
| `browser_core` | Không | `"chromium"` | Nhân trình duyệt (`chromium`, `firefox`). |
| `browser_version` | Không | - | Phiên bản trình duyệt cụ thể (ví dụ: `119.0.6045.124`). |
| `is_random_browser_version` | Không | `false` | Ngẫu nhiên hóa phiên bản trình duyệt. |
| `raw_proxy` | Không | `""` | Định dạng cấu hình proxy (Xem phần [Cấu hình Proxy](#cau-hinh-proxy) bên dưới). |
| `startup_urls` | Không | `""` | Các URL tự động mở khi khởi động (phân cách bằng dấu phẩy). |
| `os` | Không | - | Hệ điều hành chỉ định (ví dụ: `Windows 11`, `Mac OS`). |
| `is_random_os` | Không | `false` | Ngẫu nhiên hóa hệ điều hành. |
| `user_agent` | Không | - | User-agent tùy chỉnh. |
| `webrtc_mode` | Không | `2` | Chế độ WebRTC (`1`: Tắt, `2`: Dựa theo IP proxy). |
| `is_masked_font` | Không | `true` | Fake font chữ hệ thống. |
| `is_noise_canvas` | Không | `false` | Tạo nhiễu Canvas Fingerprint. |
| `is_noise_webgl` | Không | `false` | Tạo nhiễu WebGL Fingerprint. |
| `is_noise_client_rect` | Không | `false` | Tạo nhiễu Audio Fingerprint. |
| `is_noise_audio_context` | Không | `true` | Tạo nhiễu Audio Context. |
| `is_masked_webgl_data` | Không | `true` | Ẩn/Fake dữ liệu WebGL. |
| `is_masked_media_device` | Không | `true` | Ẩn/Fake thiết bị media (micro, camera). |

* **Ví dụ Body Request:**
  ```json
  {
      "profile_name": "Test profile GPM",
      "group_name": "All",
      "browser_core": "chromium",
      "browser_name": "Chrome",
      "browser_version": "119.0.6045.124",
      "is_random_browser_version": false,
      "raw_proxy": "socks5://192.168.1.100:1080:user123:pass123",
      "startup_urls": "https://google.com,https://whoer.net",
      "is_masked_font": true,
      "is_noise_canvas": true,
      "is_noise_webgl": true,
      "is_noise_client_rect": true,
      "is_noise_audio_context": true,
      "is_random_screen": false,
      "is_masked_webgl_data": true,
      "is_masked_media_device": true,
      "is_random_os": false,
      "os": "Windows 11",
      "webrtc_mode": 2,
      "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
  }
  ```

* **Phản hồi (Response) thành công:**
  ```json
  {
      "success": true,
      "data": {
          "id": "781d8439-b4c4-4203-a434-c853228110b1",
          "name": "Test profile GPM",
          "raw_proxy": "socks5://192.168.1.100:1080:user123:pass123",
          "profile_path": "wBPmeDpCbL-04122023",
          "browser_type": "Chrome",
          "browser_version": "119.0.6045.124",
          "note": null,
          "group_id": 1,
          "created_at": "2023-12-04T21:33:37.12Z"
      },
      "message": "OK"
  }
  ```

---

## 4. Mở Profile (Khởi chạy trình duyệt)

Khởi động profile và nhận địa chỉ cổng Debugging để có thể kết nối công cụ tự động hóa (Selenium/Playwright/Puppeteer).

* **API URL:** `GET /api/v3/profiles/start/{id}`
* **Tham số (Query Params):**

| Tên Param | Bắt buộc | Mô tả |
| :--- | :---: | :--- |
| `win_scale` | Không | Tỷ lệ thu phóng cửa sổ trình duyệt (giá trị từ `0.1` đến `1.0`). |
| `win_pos` | Không | Vị trí hiển thị cửa sổ trên màn hình (định dạng `x,y` ví dụ: `300,300`). |
| `win_size` | Không | Kích thước cửa sổ trình duyệt (định dạng `width,height` ví dụ: `800,600`). |
| `addination_args`| Không | Các tham số dòng lệnh Chrome bổ sung (`Chrome Arguments`). |

* **Ví dụ Request:**
  ```http
  GET http://127.0.0.1:19995/api/v3/profiles/start/781d8439-b4c4-4203-a434-c853228110b1?win_scale=0.9&win_pos=100,100&win_size=1200,800
  ```

* **Phản hồi (Response) thành công:**
  > [!IMPORTANT]
  > Giá trị `remote_debugging_address` chính là chìa khóa để bạn kết nối và điều khiển Chrome thông qua các thư viện automation.

  ```json
  {
      "success": true,
      "data": {
          "success": true,
          "profile_id": "781d8439-b4c4-4203-a434-c853228110b1",
          "browser_location": "C:\\Users\\Admin\\AppData\\Local\\Programs\\GPMLogin\\gpm_browser\\gpm_browser_chromium_core_119\\chrome.exe",
          "remote_debugging_address": "127.0.0.1:53378",
          "driver_path": "C:\\Users\\Admin\\AppData\\Local\\Programs\\GPMLogin\\gpm_browser\\gpm_browser_chromium_core_119\\gpmdriver.exe"
      },
      "message": "OK"
  }
  ```

---

## 5. Đóng Profile

Đóng cửa sổ trình duyệt đang chạy và đồng bộ hóa lại dữ liệu profile.

* **API URL:** `GET /api/v3/profiles/close/{id}`
* **Ví dụ Request:**
  ```http
  GET http://127.0.0.1:19995/api/v3/profiles/close/781d8439-b4c4-4203-a434-c853228110b1
  ```

* **Phản hồi (Response):**
  ```json
  {
      "success": true,
      "message": "Đóng thành công"
  }
  ```

---

## 6. Cập nhật Profile

Cập nhật các thông tin cấu hình như tên, proxy, ghi chú, màu sắc,... của một profile có sẵn.

* **API URL:** `POST /api/v3/profiles/update/{profile_id}`
* **Dữ liệu gửi lên (JSON Body):**
  *(Chỉ cần truyền các trường cần cập nhật)*

* **Ví dụ Body Request:**
  ```json
  {
      "profile_name": "Ebay Account 01 - Updated",
      "raw_proxy": "http://user:pass@192.168.1.1:8080",
      "note": "Cập nhật ngày 14/06",
      "color": "#FF5733"
  }
  ```

* **Phản hồi (Response):**
  ```json
  {
      "success": true,
      "message": "OK",
      "data": {}
  }
  ```

---

## 7. Xóa Profile

Xóa hoàn toàn profile ra khỏi cơ sở dữ liệu.

* **API URL:** `GET /api/v3/profiles/delete/{profile_id}`
* **Tham số (Query Params):**

| Tên Param | Bắt buộc | Mô tả |
| :--- | :---: | :--- |
| `mode` | **Có** | `1`: Chỉ xóa thông tin trên cơ sở dữ liệu ứng dụng.<br>`2`: Xóa cả thông tin cơ sở dữ liệu lẫn thư mục lưu trữ profile trên ổ cứng. |

* **Ví dụ Request:**
  ```http
  GET http://127.0.0.1:19995/api/v3/profiles/delete/781d8439-b4c4-4203-a434-c853228110b1?mode=2
  ```

* **Phản hồi (Response):**
  ```json
  {
      "success": true,
      "data": null,
      "message": "Xóa thành công"
  }
  ```

---

## 8. Danh sách Nhóm (Groups)

* **API URL:** `GET /api/v3/groups`
* **Phản hồi (Response):**
  ```json
  {
      "success": true,
      "data": [
          {
              "id": 1,
              "name": "All",
              "sort": 1,
              "created_by": -1,
              "created_at": "2023-11-13T15:50:35Z",
              "updated_at": "2023-11-13T15:50:35Z"
          }
      ],
      "message": "OK"
  }
  ```

---

## <a name="cau-hinh-proxy"></a>Cú pháp cấu hình Proxy (`raw_proxy`)

Hệ thống hỗ trợ cấu hình đa dạng các loại Proxy thông qua chuỗi cấu trúc cụ thể:

* **HTTP Proxy:** `IP:Port` hoặc `IP:Port:User:Pass`
* **Socks5 Proxy:** `socks5://IP:Port` hoặc `socks5://IP:Port:User:Pass`
* **TMProxy:** `tm://API_KEY|True` (True/False để đổi IP ngay khi khởi chạy)
* **TinProxy:** `tin://API_KEY|True`
* **Tinsoft Proxy:** `tinsoft://API_KEY|True`

---

## Hướng dẫn kết nối Selenium / Playwright (Node.js)

Dưới đây là mã ví dụ kết nối và điều khiển cửa sổ Chrome của GPM Login sau khi đã mở thông qua API.

### 1. Sử dụng Puppeteer
```javascript
const puppeteer = require('puppeteer-core');
const axios = require('axios');

async function run() {
    const profileId = "781d8439-b4c4-4203-a434-c853228110b1";
    
    // 1. Gọi API mở profile
    const response = await axios.get(`http://127.0.0.1:19995/api/v3/profiles/start/${profileId}`);
    const debugAddress = response.data.data.remote_debugging_address; // Ví dụ "127.0.0.1:53378"
    
    // 2. Kết nối Puppeteer tới trình duyệt vừa mở
    const browser = await puppeteer.connect({
        browserWSEndpoint: `ws://${debugAddress}`
    });

    const pages = await browser.pages();
    const page = pages[0] || await browser.newPage();
    
    // 3. Thực thi tự động hóa
    await page.goto('https://whoer.net');
    console.log("Tiêu đề trang:", await page.title());
}

run();
```

### 2. Sử dụng Playwright
```javascript
const { chromium } = require('playwright');
const axios = require('axios');

async function run() {
    const profileId = "781d8439-b4c4-4203-a434-c853228110b1";
    
    const response = await axios.get(`http://127.0.0.1:19995/api/v3/profiles/start/${profileId}`);
    const debugAddress = response.data.data.remote_debugging_address;
    
    // Kết nối qua cổng CDP
    const browser = await chromium.connectOverCDP(`http://${debugAddress}`);
    const context = browser.contexts()[0];
    const page = context.pages()[0] || await context.newPage();
    
    await page.goto('https://whoer.net');
}

run();
```
