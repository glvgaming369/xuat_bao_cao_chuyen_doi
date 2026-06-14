let eventSource = null;

document.addEventListener('DOMContentLoaded', () => {
    initApp();
    setupEventListeners();
});

// Khởi chạy lấy dữ liệu ban đầu
async function initApp() {
    await loadProfiles();
}

// Thiết lập lắng nghe sự kiện
void function setupEventListeners() {
    const btnStart = document.getElementById('btn-start');
    const btnStop = document.getElementById('btn-stop');
    const btnClearLogs = document.getElementById('btn-clear-logs');

    btnStart.addEventListener('click', startProcess);
    btnStop.addEventListener('click', stopProcess);
    btnClearLogs.addEventListener('click', clearLogs);
}();

// Lấy danh sách profile từ API
async function loadProfiles() {
    try {
        const response = await fetch('/api/profiles');
        const result = await response.json();
        
        if (result.success) {
            renderProfilesTable(result.data);
            document.getElementById('profile-count').innerText = `${result.data.length} profiles`;
        }
    } catch (error) {
        console.error('Không thể lấy danh sách profiles:', error);
        appendLogLine('error', '[System] Lỗi khi kết nối với máy chủ để lấy danh sách profile.');
    }
}

// Render bảng danh sách profiles
function renderProfilesTable(profiles) {
    const tbody = document.querySelector('#table-profiles tbody');
    tbody.innerHTML = '';

    if (profiles.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="text-center text-muted">Chưa có profile nào trong id.txt.</td></tr>`;
        return;
    }

    profiles.forEach(profile => {
        const tr = document.createElement('tr');
        tr.id = `row-${profile.id}`;

        let statusText = 'Đang chờ';
        let statusClass = 'waiting';

        if (profile.status === 'running') {
            statusText = 'Đang chạy';
            statusClass = 'running';
        } else if (profile.status === 'captcha') {
            statusText = 'Cần giải captcha';
            statusClass = 'captcha';
        } else if (profile.status === 'success') {
            statusText = 'Hoàn thành';
            statusClass = 'success';
        } else if (profile.status === 'nodata') {
            statusText = 'Không có dữ liệu';
            statusClass = 'nodata';
        } else if (profile.status === 'error') {
            statusText = 'Lỗi';
            statusClass = 'nodata';
        }

        tr.innerHTML = `
            <td><strong>${profile.name}</strong></td>
            <td class="text-muted"><small>${profile.id}</small></td>
            <td><span class="status-badge ${statusClass}" id="status-${profile.id}">${statusText}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

// Bắt đầu tiến trình chạy
async function startProcess() {
    const btnStart = document.getElementById('btn-start');
    const btnStop = document.getElementById('btn-stop');
    const inputThreads = document.getElementById('input-threads');
    
    btnStart.disabled = true;
    btnStop.disabled = false;
    if (inputThreads) inputThreads.disabled = true;

    // Clear captcha cards cũ
    document.getElementById('instruction-container').innerHTML = '';

    appendLogLine('system', '[System] Khởi chạy tiến trình. Đang kết nối kênh đồng bộ real-time...');
    
    // Đăng ký nhận EventSource SSE từ server
    setupEventSource();

    // Lấy số luồng chạy đồng thời từ giao diện
    const threads = inputThreads ? parseInt(inputThreads.value) || 4 : 4;
    const screenWidth = window.screen.width || 1920;
    const screenHeight = window.screen.height || 1080;

    try {
        const response = await fetch('/api/start', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                threads,
                screenWidth,
                screenHeight
            })
        });
        const result = await response.json();
        if (!result.success) {
            appendLogLine('error', `[System] Lỗi: ${result.message}`);
            resetControlButtons();
        }
    } catch (error) {
        appendLogLine('error', '[System] Lỗi kết nối khi bắt đầu chạy.');
        resetControlButtons();
    }
}

// Dừng tiến trình chạy
async function stopProcess() {
    appendLogLine('warning', '[System] Đang gửi yêu cầu dừng tiến trình...');
    try {
        await fetch('/api/stop', { method: 'POST' });
    } catch (e) {
        appendLogLine('error', '[System] Không thể gửi yêu cầu dừng.');
    }
}

// Gửi xác nhận đã giải captcha / đăng nhập thành công cho một profile cụ thể
async function confirmCaptchaSolved(profileId, buttonEl) {
    if (buttonEl) {
        buttonEl.disabled = true;
        buttonEl.innerText = 'Đang gửi tín hiệu...';
    }

    appendLogLine('system', `[System] Gửi xác nhận đăng nhập thành công cho profile ${profileId}. Đang chuyển giao quyền điều khiển tự động...`);

    try {
        const response = await fetch('/api/confirm', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ profileId })
        });
        const result = await response.json();
        if (result.success) {
            removeInstructionCard(profileId);
        } else {
            appendLogLine('error', `[System] Không thể gửi xác nhận: ${result.message}`);
            if (buttonEl) {
                buttonEl.disabled = false;
                buttonEl.innerText = 'Tôi đã đăng nhập & vào trang báo cáo thành công';
            }
        }
    } catch (error) {
        appendLogLine('error', '[System] Lỗi kết nối khi gửi xác nhận.');
        if (buttonEl) {
            buttonEl.disabled = false;
            buttonEl.innerText = 'Tôi đã đăng nhập & vào trang báo cáo thành công';
        }
    }
}

// Cấu hình EventSource SSE lắng nghe logs & status real-time
function setupEventSource() {
    if (eventSource) {
        eventSource.close();
    }

    eventSource = new EventSource('/api/logs/stream');

    eventSource.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        
        if (msg.type === 'log') {
            appendLogLine(msg.level, msg.text);
        } else if (msg.type === 'status') {
            updateProfileStatusUI(msg.profileId, msg.status);
            // Nếu trạng thái của profile không còn là captcha thì tự động ẩn thẻ hướng dẫn nếu có
            if (msg.status !== 'captcha') {
                removeInstructionCard(msg.profileId);
            }
        } else if (msg.type === 'instruction') {
            showInstructionCard(msg.profileId, msg.profileName);
        } else if (msg.type === 'finished') {
            appendLogLine('success', '[System] ĐÃ HOÀN TẤT TẤT CẢ CÁC PROFILE.');
            resetControlButtons();
            eventSource.close();
        }
    };

    eventSource.onerror = (err) => {
        console.error('Lỗi kênh SSE:', err);
        eventSource.close();
        appendLogLine('warning', '[System] Kênh truyền real-time bị ngắt. Đang thử kết nối lại...');
    };
}

// Cập nhật trạng thái profile trên bảng UI
function updateProfileStatusUI(profileId, status) {
    const badge = document.getElementById(`status-${profileId}`);
    if (!badge) return;

    // Remove old classes
    badge.className = 'status-badge';
    
    let text = 'Đang chờ';
    if (status === 'running') {
        badge.classList.add('running');
        text = 'Đang chạy';
    } else if (status === 'captcha') {
        badge.classList.add('captcha');
        text = 'Cần giải captcha';
    } else if (status === 'success') {
        badge.classList.add('success');
        text = 'Hoàn thành';
    } else if (status === 'nodata') {
        badge.classList.add('nodata');
        text = 'Không có dữ liệu';
    } else if (status === 'error') {
        badge.classList.add('nodata');
        text = 'Lỗi';
    } else {
        badge.classList.add('waiting');
    }
    
    badge.innerText = text;
}

// Tạo & hiển thị thẻ hành động hướng dẫn giải captcha riêng cho từng profile
function showInstructionCard(profileId, profileName) {
    const container = document.getElementById('instruction-container');
    if (!container) return;

    // Kiểm tra xem đã có card cho profile này chưa để tránh trùng lặp
    let card = document.getElementById(`instruction-${profileId}`);
    if (card) return;

    card = document.createElement('div');
    card.id = `instruction-${profileId}`;
    card.className = 'card instruction-card';
    card.innerHTML = `
        <div class="card-header highlight">
            <div class="pulse-icon">⚠️</div>
            <h2>Giải Captcha: ${profileName}</h2>
        </div>
        <div class="card-content">
            <p class="instruction-text">
                Trình duyệt của profile <strong class="text-neon">${profileName}</strong> đang đợi bạn kiểm tra.
            </p>
            <div class="step-guide">
                <div class="step"><span class="step-num">1</span> Hãy chuyển sang cửa sổ trình duyệt GPM của profile này.</div>
                <div class="step"><span class="step-num">2</span> Đăng nhập Shopee Affiliate và giải captcha (nếu có).</div>
                <div class="step"><span class="step-num">3</span> Đi tới trang Báo cáo chuyển đổi.</div>
            </div>
            <button class="btn btn-success btn-block btn-glow btn-confirm-captcha">
                Tôi đã đăng nhập & vào trang báo cáo thành công
            </button>
        </div>
    `;

    // Gắn sự kiện click cho button trong card
    const btnConfirm = card.querySelector('.btn-confirm-captcha');
    btnConfirm.addEventListener('click', () => {
        confirmCaptchaSolved(profileId, btnConfirm);
    });

    container.appendChild(card);
}

// Xoá thẻ hướng dẫn của một profile
function removeInstructionCard(profileId) {
    const card = document.getElementById(`instruction-${profileId}`);
    if (card) {
        card.remove();
    }
}

// Khôi phục trạng thái các button điều khiển khi kết thúc/lỗi
function resetControlButtons() {
    const btnStart = document.getElementById('btn-start');
    const btnStop = document.getElementById('btn-stop');
    const inputThreads = document.getElementById('input-threads');

    if (btnStart) btnStart.disabled = false;
    if (btnStop) btnStop.disabled = true;
    if (inputThreads) inputThreads.disabled = false;

    // Clear all captcha cards
    const container = document.getElementById('instruction-container');
    if (container) {
        container.innerHTML = '';
    }
}

// Thêm dòng log vào box console
function appendLogLine(level, text) {
    const consoleBox = document.getElementById('console-logs');
    if (!consoleBox) return;

    const div = document.createElement('div');
    div.className = `log-line ${level}`;
    
    // Định dạng thời gian
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    
    div.innerText = `[${timeStr}] ${text}`;
    consoleBox.appendChild(div);
    
    // Tự động cuộn xuống dưới cùng
    consoleBox.scrollTop = consoleBox.scrollHeight;
}

// Xóa trắng log console
function clearLogs() {
    const consoleLogs = document.getElementById('console-logs');
    if (consoleLogs) consoleLogs.innerHTML = '';
}
