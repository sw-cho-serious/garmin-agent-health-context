/**
 * ⚡ Serverless Garmin Health Context Provider for LINE Bot & AI Agents (GAS)
 * ---------------------------------------------------------------------------
 * 100% Google Apps Script (No Docker, No Python, Zero Server Maintenance).
 * Fetches real-time biometric metrics from Garmin Personal API and formats them
 * into a compact one-liner for System Prompt injection.
 *
 * Requires Script Property:
 *   - GARMIN_PERSONAL_API_KEY
 *
 * License: MIT
 */

const GARMIN_BASE_URL = 'https://personal.connectapi.garmin.com';

/**
 * Obtain or automatically refresh Garmin Bearer Token.
 * Cached for 6 hours (21,600s) via Google Apps Script CacheService.
 */
function getGarminToken_(forceRefresh) {
  const cache = CacheService.getScriptCache();
  if (!forceRefresh) {
    const cachedToken = cache.get('GARMIN_BEARER_TOKEN');
    if (cachedToken) return cachedToken;
  }

  const apiKey = PropertiesService.getScriptProperties().getProperty('GARMIN_PERSONAL_API_KEY');
  if (!apiKey) {
    throw new Error('Missing GARMIN_PERSONAL_API_KEY in Script Properties.');
  }

  const response = UrlFetchApp.fetch(
    `${GARMIN_BASE_URL}/personalapitoken-service/personal-api/personal-api-key/token`,
    {
      method: 'post',
      headers: {
        'Authorization': `ApiKey ${apiKey}`,
        'Accept': '*/*'
      },
      muteHttpExceptions: true
    }
  );

  if (response.getResponseCode() !== 200) {
    throw new Error(`Garmin token exchange failed [${response.getResponseCode()}]: ${response.getContentText()}`);
  }

  let token = response.getContentText().trim();
  try {
    const parsed = JSON.parse(token);
    token = parsed.access_token || parsed.token || token;
  } catch (e) {
    // Plaintext token string, keep as is
  }

  cache.put('GARMIN_BEARER_TOKEN', token, 21600); // 6 hours
  return token;
}

/**
 * Universal Garmin Personal API GET helper with auto-retry on HTTP 401.
 */
function fetchGarminApi_(endpoint) {
  let token = getGarminToken_(false);
  let res = UrlFetchApp.fetch(`${GARMIN_BASE_URL}${endpoint}`, {
    method: 'get',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    },
    muteHttpExceptions: true
  });

  if (res.getResponseCode() === 401) {
    token = getGarminToken_(true);
    res = UrlFetchApp.fetch(`${GARMIN_BASE_URL}${endpoint}`, {
      method: 'get',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      muteHttpExceptions: true
    });
  }

  if (res.getResponseCode() !== 200) {
    return null;
  }

  try {
    return JSON.parse(res.getContentText());
  } catch (e) {
    return null;
  }
}

/**
 * 🔹 Option 1: Lightweight Health Brief (Steps | RHR | Stress | Body Battery)
 * Cached for 15 minutes (900s).
 * Output: [2026-11-14] 步數 6500｜靜息心率 58｜壓力 22｜身體電量 78/95
 */
function getGarminSummary() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('GARMIN_BRIEF_CONTEXT');
  if (cached) return cached;

  const tz = 'Asia/Taipei';
  const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const yesterday = Utilities.formatDate(new Date(Date.now() - 86400000), tz, 'yyyy-MM-dd');
  const data = fetchGarminApi_(`/usersummary-service/v2/dailysummaries?startDate=${yesterday}&endDate=${today}`);
  const list = data?.data || [];
  const d = list[list.length - 1] || {};

  const steps = d.movement?.steps?.value ?? '-';
  const rhr = d.heartRate?.restingValue ?? '-';
  const stress = d.stress?.avgLevel ?? '-';
  const bbNow = d.bodyBattery?.latestValue ?? '-';
  const bbMax = d.bodyBattery?.maxValue ?? '-';

  const dateLabel = d.calendarDate || today;
  const brief = `[${dateLabel}] 步數 ${steps}｜靜息心率 ${rhr}｜壓力 ${stress}｜身體電量 ${bbNow}/${bbMax}`;
  cache.put('GARMIN_BRIEF_CONTEXT', brief, 900); // 15 mins
  return brief;
}

/**
 * 🚀 Option 2: Full Flagship Context (Steps | Calories | Body Battery | Sleep | HRV | Recent Workout)
 * Cached for 15 minutes (900s).
 * Output: [2026-11-14] 步數 6500｜消耗 2100 kcal｜電量 78/95｜昨晚睡眠 7.2h (82分)｜HRV 55 ms (BALANCED)｜最近運動: Strength 55min
 */
function getGarminFullContext() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('GARMIN_FULL_CONTEXT');
  if (cached) return cached;

  const tz = 'Asia/Taipei';
  const today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const yesterday = Utilities.formatDate(new Date(Date.now() - 86400000), tz, 'yyyy-MM-dd');

  // 1. Daily Summaries (Steps, Calories, Body Battery)
  let steps = '-', calories = '-', bbLatest = '-', bbMax = '-';
  let dateLabel = today;
  try {
    const sumData = fetchGarminApi_(`/usersummary-service/v2/dailysummaries?startDate=${yesterday}&endDate=${today}`);
    const list = sumData?.data || [];
    const sum = list[list.length - 1];
    if (sum) {
      dateLabel = sum.calendarDate || today;
      steps = sum.movement?.steps?.value ?? '-';
      calories = sum.calories?.burnedTotal ?? '-';
      bbLatest = sum.bodyBattery?.latestValue ?? '-';
      bbMax = sum.bodyBattery?.maxValue ?? '-';
    }
  } catch (e) {
    console.warn('Summaries fetch failed: ' + e.message);
  }

  // 2. Sleep Data (Duration & Score)
  let sleepText = '-';
  try {
    const sleepData = fetchGarminApi_(`/sleep-service/sleep/dailySleep?date=${today}`);
    const dto = sleepData?.dailySleepDTO;
    if (dto && dto.sleepTimeSeconds) {
      const hours = (dto.sleepTimeSeconds / 3600).toFixed(1);
      const score = dto.sleepScores?.overall?.value ?? '-';
      sleepText = `${hours}h (${score}分)`;
    }
  } catch (e) {
    console.warn('Sleep fetch failed: ' + e.message);
  }

  // 3. Overnight HRV
  let hrvText = '-';
  try {
    const hrvData = fetchGarminApi_(`/hrv-service/hrv/daily/${today}/${today}`);
    const hrv = hrvData?.hrvSummary;
    if (hrv && hrv.lastNightAvg) {
      const status = hrv.status ? ` (${hrv.status})` : '';
      hrvText = `${hrv.lastNightAvg} ms${status}`;
    }
  } catch (e) {
    console.warn('HRV fetch failed: ' + e.message);
  }

  // 4. Recent Workout / Activity
  let actText = '無';
  try {
    const actData = fetchGarminApi_('/activitylist-service/activities/search/activities?start=0&limit=1');
    if (Array.isArray(actData) && actData.length > 0) {
      const act = actData[0];
      const mins = Math.round((act.duration || 0) / 60);
      const name = act.activityName || '活動';
      actText = `${name} ${mins}min`;
    }
  } catch (e) {
    console.warn('Activity fetch failed: ' + e.message);
  }

  const fullLine = `[${dateLabel}] 步數 ${steps}｜消耗 ${calories} kcal｜電量 ${bbLatest}/${bbMax}｜昨晚睡眠 ${sleepText}｜HRV ${hrvText}｜最近運動: ${actText}`;
  cache.put('GARMIN_FULL_CONTEXT', fullLine, 900); // 15 mins
  return fullLine;
}
