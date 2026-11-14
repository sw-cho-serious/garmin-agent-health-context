# ⌚ Garmin Connect 生理體徵直通 AI Agent (GAS 版)

> 透過 Garmin Personal API 自動抓取使用者的步數、心率、壓力、身體電量 (Body Battery)，直接注入 AI 的 System Prompt 潛意識！
> 讓你的 AI 助理在開口時，能精準感知你今天到底累不累、壓力大不大！

## ✨ 核心特色
- **自動換約快取**：Token 快取 6 小時，遇到 401 自動刷新重試。
- **低負載設計**：體徵數據快取 15 分鐘，不頻繁敲擊 Garmin 伺服器。
- **一行搞定 System Prompt**：直接輸出乾淨字串 `[2026-11-14] 步數 6500｜靜息心率 58｜壓力 22｜身體電量 78/95`。

## 🔑 事前準備
1. 前往 Garmin Developer 申請取得個人的 `GARMIN_PERSONAL_API_KEY`。
2. 在 Google Apps Script 的「專案設定 ➔ 指令碼屬性」中新增：
   - 屬性名稱：`GARMIN_PERSONAL_API_KEY`
   - 屬性值：你的 API Key

## 💻 完整乾淨原始碼 (garmin-health.js)
```javascript
/**
 * ⌚ Garmin 手錶即時體徵數據模組 (去敏通用版)
 */

function getGarminToken_(forceRefresh) {
  const cache = CacheService.getScriptCache();
  if (!forceRefresh) {
    const cached = cache.get('GARMIN_ACCESS_TOKEN');
    if (cached) return cached;
  }

  const apiKey = PropertiesService.getScriptProperties().getProperty('GARMIN_PERSONAL_API_KEY');
  if (!apiKey) throw new Error('缺少 GARMIN_PERSONAL_API_KEY 屬性');

  const res = UrlFetchApp.fetch(
    'https://personal.connectapi.garmin.com/personalapitoken-service/personal-api/personal-api-key/token',
    { method: 'post', headers: { 'Authorization': 'ApiKey ' + apiKey }, muteHttpExceptions: true }
  );
  if (res.getResponseCode() !== 200) throw new Error('Garmin 換 Token 失敗: ' + res.getContentText());

  let token = res.getContentText().trim();
  try {
    const parsed = JSON.parse(token);
    token = parsed.access_token || parsed.token || token;
  } catch (e) {}

  cache.put('GARMIN_ACCESS_TOKEN', token, 21600); // 快取 6 小時
  return token;
}

function getGarminSummary() {
  const cache = CacheService.getScriptCache();
  const cachedSummary = cache.get('GARMIN_SUMMARY_V2');
  if (cachedSummary) return cachedSummary;

  const tz = 'Asia/Taipei';
  const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const yesterday = Utilities.formatDate(new Date(Date.now() - 86400000), tz, 'yyyy-MM-dd');
  const url = `https://personal.connectapi.garmin.com/usersummary-service/v2/dailysummaries?startDate=${yesterday}&endDate=${today}`;

  let token = getGarminToken_(false);
  let res = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' },
    muteHttpExceptions: true
  });

  if (res.getResponseCode() === 401) {
    token = getGarminToken_(true);
    res = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' },
      muteHttpExceptions: true
    });
  }

  if (res.getResponseCode() !== 200) return '（Garmin 讀取失敗）';
  const json = JSON.parse(res.getContentText());
  const list = json.data || [];
  const d = list[list.length - 1] || {};
  const steps = d.movement?.steps?.value ?? '-';
  const rhr = d.heartRate?.restingValue ?? '-';
  const stress = d.stress?.avgLevel ?? '-';
  const bbNow = d.bodyBattery?.latestValue ?? '-';
  const bbMax = d.bodyBattery?.maxValue ?? '-';

  const dateLabel = d.calendarDate || today;
  const summary = `[${dateLabel}] 步數 ${steps}｜靜息心率 ${rhr}｜壓力 ${stress}｜身體電量 ${bbNow}/${bbMax}`;
  cache.put('GARMIN_SUMMARY_V2', summary, 900); // 快取 15 分鐘
  return summary;
}
```

## 📄 License
MIT License
