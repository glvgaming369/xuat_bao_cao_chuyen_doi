const fs = require('fs');
const path = require('path');
const express = require('express');
const axios = require('axios');
const { chromium } = require('patchright');

const app = express();
const PORT = 3000;
const GPM_API_BASE = 'http://127.0.0.1:19995';

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Sleep helper
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Tạo thư mục downloads nếu chưa có
const downloadDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
}

// Danh sách các SSE clients đang kết nối
let sseClients = [];

// Quản lý trạng thái chờ captcha độc lập cho từng profile ID
// Ví dụ: { "profile-id-1": true, "profile-id-2": false }
let waitingProfiles = {};

let isStopped = false;
let isRunning = false;

// Đọc danh sách profile IDs từ id.txt
function getProfileIds() {
    const filePath = path.join(__dirname, 'id.txt');
    if (!fs.existsSync(filePath)) {
        return [];
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return content.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
}

// Lấy thông tin profile từ GPM
async function getProfileInfo(profileId) {
    try {
        const response = await axios.get(`${GPM_API_BASE}/api/v3/profiles/${profileId}`);
        if (response.data && response.data.success) {
            return response.data.data;
        }
    } catch (e) {
        // Lỗi nhẹ, bỏ qua
    }
    return null;
}

// Gọi API mở profile với kích thước và vị trí phân chia lưới
async function startProfile(profileId, winSize, winPos) {
    let url = `${GPM_API_BASE}/api/v3/profiles/start/${profileId}`;
    const params = [];
    if (winSize) params.push(`win_size=${winSize}`);
    if (winPos) params.push(`win_pos=${winPos}`);
    if (params.length > 0) {
        url += `?${params.join('&')}`;
    }
    const response = await axios.get(url);
    if (response.data && response.data.success) {
        return response.data.data;
    }
    throw new Error(response.data ? response.data.message : 'Lỗi không xác định khi mở profile GPM');
}

// Gọi API đóng profile
async function closeProfile(profileId) {
    const response = await axios.get(`${GPM_API_BASE}/api/v3/profiles/close/${profileId}`);
    return response.data && response.data.success;
}

// Stream dữ liệu qua Server-Sent Events (SSE)
app.get('/api/logs/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    sseClients.push(res);

    req.on('close', () => {
        sseClients = sseClients.filter(client => client !== res);
    });
});

// Hàm phát tán log cho toàn bộ Client UI
function broadcastLog(level, text) {
    console.log(`[${level.toUpperCase()}] ${text}`);
    sseClients.forEach(client => {
        client.write(`data: ${JSON.stringify({ type: 'log', level, text })}\n\n`);
    });
}

// Hàm phát tán cập nhật trạng thái profile
function broadcastStatus(profileId, status) {
    sseClients.forEach(client => {
        client.write(`data: ${JSON.stringify({ type: 'status', profileId, status })}\n\n`);
    });
}

// Hàm gửi chỉ dẫn giải captcha cho UI (kèm theo profileId)
function broadcastInstruction(profileId, profileName) {
    sseClients.forEach(client => {
        client.write(`data: ${JSON.stringify({ type: 'instruction', profileId, profileName })}\n\n`);
    });
}

// Hàm báo hiệu kết thúc tiến trình
function broadcastFinished() {
    sseClients.forEach(client => {
        client.write(`data: ${JSON.stringify({ type: 'finished' })}\n\n`);
    });
}

// API: Lấy danh sách profiles hiển thị lên bảng
app.get('/api/profiles', async (req, res) => {
    const ids = getProfileIds();
    const profilesData = [];

    for (const id of ids) {
        const info = await getProfileInfo(id);
        profilesData.push({
            id,
            name: info ? info.name : `Profile_${id.substring(0, 8)}`,
            status: 'waiting'
        });
    }

    res.json({ success: true, data: profilesData });
});

// API: Xác nhận đã đăng nhập & giải xong captcha cho từng profile cụ thể
app.post('/api/confirm', (req, res) => {
    const { profileId } = req.body;
    if (profileId && waitingProfiles[profileId] !== undefined) {
        waitingProfiles[profileId] = false;
        res.json({ success: true, message: `Đã xác nhận cho profile ${profileId}.` });
    } else {
        res.json({ success: false, message: 'ID profile không hợp lệ hoặc không ở trạng thái chờ.' });
    }
});

// API: Dừng tiến trình chạy
app.post('/api/stop', (req, res) => {
    isStopped = true;
    // Giải phóng tất cả các luồng đang chờ
    for (const id in waitingProfiles) {
        waitingProfiles[id] = false;
    }
    res.json({ success: true, message: 'Yêu cầu dừng đã được gửi.' });
});

// Click mô phỏng hành vi di chuyển chuột
async function humanClick(page, locator) {
    try {
        await locator.waitFor({ state: 'visible', timeout: 8000 });
        const box = await locator.boundingBox();
        if (box) {
            const x = box.x + box.width / 2 + (Math.random() * 6 - 3);
            const y = box.y + box.height / 2 + (Math.random() * 6 - 3);
            await page.mouse.move(x, y, { steps: 8 });
            await sleep(150 + Math.random() * 100);
            await page.mouse.click(x, y);
            return true;
        }
    } catch (e) {
        // Fallback
    }
    await locator.click();
}

// Chờ nút xuất hiện
async function waitForSelectorWithStatusCheck(page, locator, timeoutMs = 20000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
        if (isStopped) throw new Error('Tiến trình bị dừng bởi người dùng.');
        if (await locator.count() > 0) {
            const isVisible = await locator.first().isVisible().catch(() => false);
            if (isVisible) return locator.first();
        }
        await sleep(1000);
    }
    throw new Error(`Timeout chờ selector xuất hiện.`);
}

// Kiểm tra xem trang hiện tại có đang hiển thị Captcha hay không
async function checkCaptchaActive(page) {
    try {
        const url = page.url();
        const isCaptchaUrl = url.includes('shopee.vn/verify/captcha') || url.includes('shopee.vn/verify/traffic');
        const captchaSelectorExists = await page.evaluate(() => {
            return !!document.querySelector('.shopee-captcha') || 
                   !!document.querySelector('iframe[src*="captcha"]') ||
                   !!document.getElementById('captcha-container') ||
                   (!!document.querySelector('div[class*="captcha"]') && document.body.innerText.includes('Thử lại'));
        }).catch(() => false);
        return isCaptchaUrl || captchaSelectorExists;
    } catch (e) {
        return false;
    }
}

// API: Bắt đầu tiến trình tải báo cáo hỗ trợ đa luồng song song
app.post('/api/start', async (req, res) => {
    if (isRunning) {
        return res.json({ success: false, message: 'Tiến trình đang chạy rồi.' });
    }

    const concurrencyLimit = parseInt(req.body.threads) || 4;
    const screenWidth = parseInt(req.body.screenWidth) || 1920;
    const screenHeight = parseInt(req.body.screenHeight) || 1080;
    isRunning = true;
    isStopped = false;
    waitingProfiles = {};
    
    res.json({ success: true, message: `Đã bắt đầu chạy với ${concurrencyLimit} luồng.` });

    // Khởi chạy bất đồng bộ đa luồng song song
    (async () => {
        const ids = getProfileIds();
        broadcastLog('system', `[System] Bắt đầu xử lý ${ids.length} profiles (Đồng thời tối đa: ${concurrencyLimit} luồng). Màn hình: ${screenWidth}x${screenHeight}`);

        const availableSlots = new Array(concurrencyLimit).fill(true);

        // Định nghĩa task xử lý cho 1 profile cụ thể
        const processProfile = async (id) => {
            if (isStopped) return;

            // Tìm slot trống
            let slotIndex = availableSlots.findIndex(val => val === true);
            if (slotIndex === -1) slotIndex = 0;
            availableSlots[slotIndex] = false;

            // Tính toán kích thước và vị trí theo dạng lưới (Grid Layout)
            const cols = Math.ceil(Math.sqrt(concurrencyLimit));
            const rows = Math.ceil(concurrencyLimit / cols);
            const w = Math.floor(screenWidth / cols);
            const h = Math.floor((screenHeight - 50) / rows); // Trừ 50px cho thanh taskbar
            
            const col = slotIndex % cols;
            const row = Math.floor(slotIndex / cols);
            const x = col * w;
            const y = row * h;

            const winSize = `${w},${h}`;
            const winPos = `${x},${y}`;

            try {
                const info = await getProfileInfo(id);
                const profileName = info ? info.name : `Profile_${id.substring(0, 8)}`;

                broadcastLog('info', `[Luồng - Slot ${slotIndex + 1}] Bắt đầu chạy Profile: ${profileName} (${winSize} tại ${winPos})`);
                broadcastStatus(id, 'running');

                let gpmData = null;
                try {
                    gpmData = await startProfile(id, winSize, winPos);
                    broadcastLog('success', `[GPM] Đã mở profile thành công: ${profileName}`);
                } catch (err) {
                    broadcastLog('error', `[GPM - ${profileName}] Không thể mở: ${err.message}`);
                    broadcastStatus(id, 'error');
                    return;
                }

                const debugAddress = gpmData.remote_debugging_address;

                // Đăng ký trạng thái chờ cho profile này
                waitingProfiles[id] = true;
                broadcastLog('warning', `[Bảo mật - ${profileName}] Hãy kiểm tra trình duyệt và đăng nhập/giải captcha nếu cần...`);
                broadcastStatus(id, 'captcha');
                broadcastInstruction(id, profileName);

                // Chờ người dùng nhấn Xác nhận giải captcha riêng cho profile này
                while (waitingProfiles[id] && !isStopped) {
                    await sleep(1000);
                }

                if (isStopped) {
                    await closeProfile(id).catch(() => {});
                    return;
                }

                broadcastLog('info', `[Patchright - ${profileName}] Kết nối CDP tới trình duyệt...`);

                let browser = null;
                try {
                    // Kết nối CDP
                    const maxRetries = 5;
                    for (let attempt = 1; attempt <= maxRetries; attempt++) {
                        try {
                            browser = await chromium.connectOverCDP(`http://${debugAddress}`);
                            break;
                        } catch (connectError) {
                            if (attempt === maxRetries) throw connectError;
                            broadcastLog('warning', `[-] ${profileName} kết nối CDP thất bại lần ${attempt}. Thử lại...`);
                            await sleep(1500);
                        }
                    }

                    broadcastLog('success', `[Patchright - ${profileName}] Kết nối CDP thành công!`);

                    let context = browser.contexts()[0];
                    let page = context.pages()[0] || await context.newPage();
                    page.setDefaultTimeout(30000);

                    // Chặn request telemetry
                    await context.route('**/*', (route) => {
                        const url = route.request().url();
                        if (
                            url.includes('/api/v4/client/log') || 
                            url.includes('/api/v2/analytics') || 
                            url.includes('/api/v1/collect') ||
                            url.includes('/api/v1/security/report')
                        ) {
                            return route.abort();
                        }
                        return route.continue();
                    });

                    // Kiểm tra URL hiện tại
                    let currentUrl = page.url();
                    if (!currentUrl.includes('/report/conversion_report')) {
                        broadcastLog('info', `[Điều hướng - ${profileName}] Chuyển hướng tới trang báo cáo...`);
                        await page.goto('https://affiliate.shopee.vn/report/conversion_report', { waitUntil: 'domcontentloaded' });
                        await sleep(4000);
                    }

                    // Check dữ liệu trống
                    const noDataEl = page.locator('xpath=//*[text()="Không có dữ liệu" or text()="No Data"]');
                    if (await noDataEl.count() > 0 && await noDataEl.isVisible()) {
                        broadcastLog('warning', `[-] Profile ${profileName}: Shopee báo Không có dữ liệu.`);
                        broadcastStatus(id, 'nodata');
                        await browser.close();
                        await closeProfile(id);
                        return;
                    }

                    // Click xuất dữ liệu
                    const exportButton = page.locator('xpath=//a[text()="Xuất dữ liệu" or text()="Export" or contains(@class, "export-btn")] | //button[contains(., "Xuất dữ liệu") or contains(., "Export")]');
                    broadcastLog('info', `[Quy trình - ${profileName}] Đang chờ nút Xuất dữ liệu...`);
                    try {
                        const btn = await waitForSelectorWithStatusCheck(page, exportButton, 20000);
                        broadcastLog('info', `[Quy trình - ${profileName}] Click nút Xuất dữ liệu...`);
                        await humanClick(page, btn);
                        
                        await sleep(3500); // Chờ load trang
                        
                        // Kiểm tra xem có bị captcha sau khi click xuất không
                        const isCaptcha = await checkCaptchaActive(page);
                        if (isCaptcha) {
                            broadcastLog('warning', `[Bảo mật - ${profileName}] Phát hiện CAPTCHA xuất hiện sau khi click Xuất dữ liệu!`);
                            broadcastLog('warning', `[Stealth - ${profileName}] Đang ngắt kết nối CDP để giải captcha...`);
                            
                            await browser.close();
                            browser = null; // Tránh đóng lại ở catch block
                            
                            // Yêu cầu giải captcha lần 2
                            waitingProfiles[id] = true;
                            broadcastStatus(id, 'captcha');
                            broadcastInstruction(id, profileName);
                            
                            while (waitingProfiles[id] && !isStopped) {
                                await sleep(1000);
                            }
                            
                            if (isStopped) {
                                await closeProfile(id).catch(() => {});
                                return;
                            }
                            
                            // Kết nối lại CDP
                            broadcastLog('info', `[Patchright - ${profileName}] Kết nối lại CDP...`);
                            for (let attempt = 1; attempt <= 5; attempt++) {
                                try {
                                    browser = await chromium.connectOverCDP(`http://${debugAddress}`);
                                    break;
                                } catch (connectError) {
                                    if (attempt === 5) throw connectError;
                                    await sleep(1500);
                                }
                            }
                            broadcastLog('success', `[Patchright - ${profileName}] Kết nối lại CDP thành công!`);
                            
                            context = browser.contexts()[0];
                            page = context.pages()[0] || await context.newPage();
                            page.setDefaultTimeout(30000);
                            
                            await context.route('**/*', (route) => {
                                const url = route.request().url();
                                if (
                                    url.includes('/api/v4/client/log') || 
                                    url.includes('/api/v2/analytics') || 
                                    url.includes('/api/v1/collect') ||
                                    url.includes('/api/v1/security/report')
                                ) {
                                    return route.abort();
                                }
                                return route.continue();
                            });

                            // Đảm bảo ở đúng trang báo cáo
                            currentUrl = page.url();
                            if (!currentUrl.includes('/report/conversion_report')) {
                                await page.goto('https://affiliate.shopee.vn/report/conversion_report', { waitUntil: 'domcontentloaded' });
                                await sleep(4000);
                            }

                            // Thực hiện click lại lần 2
                            broadcastLog('info', `[Quy trình - ${profileName}] Click Xuất dữ liệu lại lần 2...`);
                            const btn2 = await waitForSelectorWithStatusCheck(page, exportButton, 20000);
                            await humanClick(page, btn2);
                            await sleep(5000);
                        } else {
                            broadcastLog('success', `[Quy trình - ${profileName}] Click Xuất dữ liệu thành công!`);
                        }
                    } catch (e) {
                        broadcastLog('warning', `[-] ${profileName} gặp sự cố click xuất: ${e.message}`);
                    }

                    // Sang trang export management
                    broadcastLog('info', `[Điều hướng - ${profileName}] Truy cập trang quản lý xuất dữ liệu...`);
                    try {
                        await page.goto('https://affiliate.shopee.vn/export_management', { waitUntil: 'domcontentloaded', timeout: 45000 });
                        await sleep(5000);
                    } catch (e) {
                        await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
                        await sleep(5000);
                    }

                    // Đợi file sẵn sàng để tải
                    const firstDownloadLink = page.locator('xpath=(//a[contains(@class, "download") or contains(@href, "download") or contains(., "Tải xuống") or contains(., "Download")])[1] | (//*[@class="export-item-file-name"])[1]');
                    
                    try {
                        const downloadBtn = await waitForSelectorWithStatusCheck(page, firstDownloadLink, 25000);
                        
                        const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
                        broadcastLog('info', `[Tải file - ${profileName}] Đang tải file báo cáo...`);
                        await humanClick(page, downloadBtn);
                        
                        const download = await downloadPromise;
                        const newFileName = `${profileName}.csv`;
                        const savePath = path.join(downloadDir, newFileName);
                        
                        await download.saveAs(savePath);
                        broadcastLog('success', `[Tải file - ${profileName}] ĐÃ TẢI THÀNH CÔNG: ${newFileName}`);
                        broadcastStatus(id, 'success');
                    } catch (e) {
                        broadcastLog('error', `[-] ${profileName} lỗi tải file: ${e.message}`);
                        broadcastStatus(id, 'error');
                    }

                    await browser.close();
                } catch (err) {
                    broadcastLog('error', `[-] ${profileName} gặp sự cố tự động hóa: ${err.message}`);
                    broadcastStatus(id, 'error');
                    if (browser) {
                        try { await browser.close(); } catch(e) {}
                    }
                }

                // Đóng profile GPM
                await closeProfile(id).catch(() => {});
                broadcastLog('info', `Đã đóng profile: ${profileName}`);
                await sleep(2000);
            } finally {
                // Giải phóng slot khi hoàn tất
                availableSlots[slotIndex] = true;
            }
        };

        // Cơ chế giới hạn luồng chạy song song (Concurrency Limit) tự chế gọn nhẹ
        const runConcurrent = async (profileIds, limit) => {
            const executing = new Set();
            const results = [];
            
            for (const id of profileIds) {
                if (isStopped) break;
                
                const task = () => processProfile(id);
                const p = Promise.resolve().then(() => task());
                results.push(p);
                executing.add(p);
                
                const clean = () => executing.delete(p);
                p.then(clean, clean);
                
                if (executing.size >= limit) {
                    await Promise.race(executing);
                }
            }
            return Promise.all(results);
        };

        await runConcurrent(ids, concurrencyLimit);

        broadcastFinished();
        isRunning = false;
    })();
});

// Khởi chạy server
app.listen(PORT, () => {
    console.log(`======================================================`);
    console.log(`[OK] SERVER ĐÃ CHẠY TẠI ĐỊA CHỈ: http://localhost:${PORT}`);
    console.log(`======================================================`);
});
