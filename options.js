const DEFAULTS = {
    enabled: true,
    startHour: 17,
    startMinute: 0,
    intervalMinutes: 15,
    days: [1, 2, 3, 4, 5],
    latestHour: 23,
    latestMinute: 59,
    skipToday: false,
    lastSkipDate: ''
};

function ymd(d) {
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
}

function hmsToTimeInput(h, m) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function timeInputToHM(value) {
    const [h, m] = value.split(':').map(Number);
    return { h, m };
}

// 根據目前狀態切換按鈕文字
function updateSkipButtonUI(s) {
    const btn = document.getElementById('skipToday');
    const today = ymd(new Date());
    const isSkippedToday = s.skipToday && s.lastSkipDate === today;
    btn.textContent = isSkippedToday ? '今天還是提醒一下吧' : '今天先不要提醒';
}

// 顯示系統通知（Options 頁可直接呼叫）
function notify({ message, title = '你的下班提醒好朋友' }) {
    chrome.notifications.create('', {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: title,
        message,
        priority: 2
    });
}

async function loadSettings() {
    const s = { ...DEFAULTS, ...(await chrome.storage.sync.get(Object.keys(DEFAULTS))) };
    document.getElementById('enabled').checked = s.enabled;
    document.getElementById('skipTaiwanHolidays').checked = s.skipTaiwanHolidays;
    document.getElementById('startTime').value = hmsToTimeInput(s.startHour, s.startMinute);
    document.getElementById('interval').value = s.intervalMinutes;
    document.getElementById('latestTime').value = hmsToTimeInput(s.latestHour, s.latestMinute);

    const daysDiv = document.getElementById('days');
    daysDiv.innerHTML = '';
    const labels = ['一', '二', '三', '四', '五', '六', '日'];
    for (let i = 1; i <= 7; i++) {
        const wrap = document.createElement('label');
        const cb = document.createElement('input');
        const txt = document.createElement('span');

        cb.type = 'checkbox';
        cb.value = i;
        cb.checked = s.days.includes(i);
        cb.id=`checkbox-week-${i}`;
        cb.className = 'checkbox';

        txt.textContent = `週${labels[i - 1]}`;
        wrap.setAttribute('for', `checkbox-week-${i}`);
        // 讓樣式能套到（checkbox + span）
        wrap.appendChild(cb);
        wrap.appendChild(txt);

        daysDiv.appendChild(wrap);
    }
}

async function saveSettings() {
    const enabled = document.getElementById('enabled').checked;
    const skipTaiwanHolidays = document.getElementById('skipTaiwanHolidays').checked;
    const { h: sh, m: sm } = timeInputToHM(document.getElementById('startTime').value);
    const intervalMinutes = Math.max(1, Number(document.getElementById('interval').value || 1));
    const { h: lh, m: lm } = timeInputToHM(document.getElementById('latestTime').value);
    const days = Array.from(document.querySelectorAll('#days input[type="checkbox"]')).filter(cb => cb.checked).map(cb => Number(cb.value));

    // 同步設定
    await chrome.storage.sync.set({
        enabled,
        startHour: sh,
        startMinute: sm,
        intervalMinutes,
        latestHour: lh,
        latestMinute: lm,
        days: days.length ? days : [1, 2, 3, 4, 5],
        skipTaiwanHolidays,
    });

    const status = document.getElementById('status');
    status.textContent = '已儲存設定。';
    console.log(`[Time to Clock Out!]: ${status.textContent}`)
    setTimeout(() => status.textContent = '', 1500);
}

// 取代原本的 skipToday()：改為「單一按鈕切換」＋通知
async function toggleSkipToday() {
    const today = ymd(new Date());
    const s = { ...DEFAULTS, ...(await chrome.storage.sync.get(Object.keys(DEFAULTS))) };
    const isSkippedToday = s.skipToday && s.lastSkipDate === today;

    if (isSkippedToday) {
        // 目前在「今日不再提醒」狀態 → 恢復
        await chrome.storage.sync.set({ skipToday: false });
        notify({ message: '今日提醒已恢復', title: '您的下班好朋友已上線 😎' });
    } else {
        // 目前在「可提醒」狀態 → 今日不再提醒
        await chrome.storage.sync.set({ skipToday: true, lastSkipDate: today });
        notify({ message:'今日不再提醒', title: '您的下班好朋友已下線 🫥'});
    }

    // 立即更新按鈕文字
    const s2 = { ...DEFAULTS, ...(await chrome.storage.sync.get(Object.keys(DEFAULTS))) };
    updateSkipButtonUI(s2);

    // 可選：背景立刻判斷一次（讓效果更即時）
    // chrome.runtime.sendMessage({ type: isSkippedToday ? 'CHECK_NOW' : 'CHECK_NOW' });
}

document.getElementById('save').addEventListener('click', saveSettings);
document.getElementById('skipToday').addEventListener('click', toggleSkipToday);

loadSettings();