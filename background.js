// 預設設定值
const DEFAULTS = {
    enabled: true,
    startHour: 17,       // 17:00 後才提醒
    startMinute: 0,
    intervalMinutes: 15, // 每 15 分鐘
    days: [1, 2, 3, 4, 5],
    latestHour: 23,
    latestMinute: 0,
    lastNotifiedAt: 0,
    skipToday: false,
    lastSkipDate: '',
    skipTaiwanHoliday: true,
};

let HOLIDAYS = {};
let HOLIDAYS_YEAR = null;

async function getSettings() {
    const fromSync = await chrome.storage.sync.get(Object.keys(DEFAULTS));
    return { ...DEFAULTS, ...fromSync };
}

async function setSettings(patch) {
    const current = await getSettings();
    const next = { ...current, ...patch };
    await chrome.storage.sync.set(next);
}

function inDays(days, jsDay) {
    const dayNum = jsDay === 0 ? 7 : jsDay;
    return days.includes(dayNum);
}

function isAfterTime(now, hour, minute) {
    return now.getHours() > hour || (now.getHours() === hour && now.getMinutes() >= minute);
}

function isBeforeOrEqualTime(now, hour, minute) {
    return now.getHours() < hour || (now.getHours() === hour && now.getMinutes() <= minute);
}

function ymd(d) {
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
}

// 台灣假日 API（行政院人事行政總處提供 JSON 格式）
async function isTaiwanHoliday(date) {
    await ensureHolidays(date.getFullYear());
    return !!HOLIDAYS[ymd(date)];
}

async function ensureHolidays(year) {
    if (HOLIDAYS_YEAR === year && Object.keys(HOLIDAYS).length) return;
    try {
        const url = `https://cdn.jsdelivr.net/gh/ruyut/TaiwanCalendar/data/${year}.json`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('holiday fetch failed');
        const arr = await res.json();
        const map = {}
        for (const item of arr) {
            if (item.isHoliday === "是") {
                const yyyy = item.date.slice(0, 4), mm = item.date.slice(4, 6), dd = item.date.slice(6, 8);
                map[`${yyyy}-${mm}-${dd}`] = true;
            }
        }
        HOLIDAYS = map;
        HOLIDAYS_YEAR = year;
    } catch (e) {
        console.warn('[time-to-clock-out] holiday load failed', e);
        HOLIDAYS = {};
        HOLIDAYS_YEAR = year;
    }
}

async function maybeNotify(immediate = false) {
    const s = await getSettings();
    if (!s.enabled) return;

    const now = new Date();
    // 工作日判斷
    if (!inDays(s.days, now.getDay())) return;

    // 今天是否已點「跳過提醒」
    const todayStr = ymd(now);
    if (s.skipToday && s.lastSkipDate === todayStr) return;

    if (s.skipTaiwanHolidays && await isTaiwanHoliday(now)) return;

    const afterStart = isAfterTime(now, s.startHour, s.startMinute);
    const beforeEnd = isBeforeOrEqualTime(now, s.latestHour, s.latestMinute);
    if (!(afterStart && beforeEnd)) return;

    chrome.idle.queryState(60, async (state) => {
        if (state !== 'active') return;

        const nowTs = Date.now();
        const due = immediate || (nowTs - (s.lastNotifiedAt || 0)) >= s.intervalMinutes * 60 * 1000;
        if (!due) return;

        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        chrome.notifications.create('', {
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: '差不多要下班囉！🤩',
            message: `現在 ${timeStr}，記得收尾、收書包、備份、打卡、去尿尿或關機～`,
            priority: 2
        });

        console.log(`[Time to Clock out!]: ${timeStr}! Ready to leave the office! Collect your stuff and RUN !!!`)

        await setSettings({ lastNotifiedAt: nowTs });
    });
}

function ensureTicker() {
    chrome.alarms.create('tick', { periodInMinutes: 1 });
}

/**
 * Event listener
 */
chrome.runtime.onInstalled.addListener(async () => {
    const current = await chrome.storage.sync.get(Object.keys(DEFAULTS));
    const patch = {};
    for (const k of Object.keys(DEFAULTS)) {
        if (current[k] === undefined) patch[k] = DEFAULTS[k];
    }
    if (Object.keys(patch).length) await chrome.storage.sync.set(patch);
    ensureTicker();
    maybeNotify(true);
});

chrome.runtime.onStartup.addListener(() => {
    ensureTicker();
    maybeNotify(true);
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'tick') maybeNotify(false);
});

chrome.idle.onStateChanged.addListener((newState) => {
    if (newState === 'active') maybeNotify(true);
});