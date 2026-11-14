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
