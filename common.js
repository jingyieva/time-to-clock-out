// common.js
export const DEFAULTS = {
  enabled: true,
  startHour: 17,            // 預設 17:00 後才提醒
  startMinute: 0,
  intervalMinutes: 15,      // 每15分鐘提醒
  days: [1, 2, 3, 4, 5],
  latestHour: 23,
  latestMinute: 0,
  lastNotifiedAt: 0,
  skipToday: false,
  lastSkipDate: '',
  skipTaiwanHolidays: true
};
/** Date related */
export function ymd(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function isAfterTime(now, h, m) {
  return now.getHours() > h || (now.getHours() === h && now.getMinutes() >= m);
}

export function isBeforeOrEqualTime(now, h, m) {
  return now.getHours() < h || (now.getHours() === h && now.getMinutes() <= m);
}

/** Notification related */
export function notify({ 
    id = '',
    title = '你的下班提醒好朋友', 
    type = 'basic',
    message, 
    actions = [],
}) {
    chrome.notifications.create(id, {
        type,
        iconUrl: 'icons/icon128.png',
        title,
        message,
        priority: 2,
        buttons: actions
    });
}
