# 🚀 Stop Building Garmin MCP Servers — 70 Lines of Serverless JS for Any AI Agent

> English | [繁體中文](./README.zh-TW.md)

Pull real-time health metrics — **Steps, Resting Heart Rate, Stress, and Body Battery** — from the official **Garmin Personal API** and inject them straight into your AI Agent's System Prompt as a compact one-liner.  
Let your AI assistant naturally sense how tired or stressed you are before it even says hello.

## ✨ Features
- **Auto-Refreshing Token Cache**: Caches the Bearer token for 6 hours and automatically retries on HTTP `401`.
- **Low-Overhead Polling**: Caches health summaries for 15 minutes to avoid hammering Garmin's endpoints.
- **One-Line System Prompt Injection**: Outputs a clean, token-efficient summary string like:  
  `[2026-11-14] 步數 6500｜靜息心率 58｜壓力 22｜身體電量 78/95`

## 🔑 Prerequisites
1. Generate your personal `GARMIN_PERSONAL_API_KEY` from **Garmin Connect Web → Settings → Personal API Key**.
2. In your Google Apps Script project, go to **Project Settings → Script Properties** and add:
   - Property: `GARMIN_PERSONAL_API_KEY`
   - Value: `<your-api-key>`

## 💻 Source Code ([`garmin-health.js`](./garmin-health.js))

```javascript
/**
 * ⌚ Garmin Watch Real-Time Health Metrics Module (GAS)
 */

function getGarminToken_(forceRefresh) {
  const cache = CacheService.getScriptCache();
  if (!forceRefresh) {
    const cached = cache.get('GARMIN_ACCESS_TOKEN');
    if (cached) return cached;
  }

  const apiKey = PropertiesService.getScriptProperties().getProperty('GARMIN_PERSONAL_API_KEY');
  if (!apiKey) throw new Error('Missing GARMIN_PERSONAL_API_KEY in ScriptProperties');

  const res = UrlFetchApp.fetch(
    'https://personal.connectapi.garmin.com/personalapitoken-service/personal-api/personal-api-key/token',
    { method: 'post', headers: { 'Authorization': 'ApiKey ' + apiKey }, muteHttpExceptions: true }
  );
  if (res.getResponseCode() !== 200) throw new Error('Garmin token exchange failed: ' + res.getContentText());

  let token = res.getContentText().trim();
  try {
    const parsed = JSON.parse(token);
    token = parsed.access_token || parsed.token || token;
  } catch (e) {}

  cache.put('GARMIN_ACCESS_TOKEN', token, 21600); // Cache for 6 hours
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

  if (res.getResponseCode() !== 200) return '（Garmin read failed）';
  const json = JSON.parse(res.getContentText());
  const list = json.data || [];
  const d = list[list.length - 1] || {};
  const steps = d.movement?.steps?.value ?? '-';
  const rhr = d.heartRate?.restingValue ?? '-';
  const stress = d.stress?.avgLevel ?? '-';
  const bbNow = d.bodyBattery?.latestValue ?? '-';
  const bbMax = d.bodyBattery?.maxValue ?? '-';

  const dateLabel = d.calendarDate || today;
  const summary = `[${dateLabel}] Steps ${steps} | RHR ${rhr} | Stress ${stress} | Body Battery ${bbNow}/${bbMax}`;
  cache.put('GARMIN_SUMMARY_V2', summary, 900); // Cache for 15 minutes
  return summary;
}
```

> Note: Adjust `tz` (default `Asia/Taipei`) and the summary string format in [`garmin-health.js`](./garmin-health.js) to match your preferred timezone and language.

## 🌐 Optional: Expose as a Serverless Webhook for Other AI Agents

Because Google Apps Script can be deployed as a stateless HTTPS Web App, you can also expose `garmin-health.js` as a zero-cost JSON endpoint for **n8n, Make, Dify, Coze, ChatGPT Actions, or custom AI agents**:

1. In **Project Settings → Script Properties**, add `WEBHOOK_SECRET` with a strong random token.
2. [`garmin-health.js`](./garmin-health.js) already includes a `doGet(e)` handler:
```javascript
function doGet(e) {
  const secret = PropertiesService.getScriptProperties().getProperty('WEBHOOK_SECRET');
  if (!secret || e?.parameter?.secret !== secret) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Unauthorized' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput(JSON.stringify({
    ok: true,
    summary: getGarminSummary()
  })).setMimeType(ContentService.MimeType.JSON);
}
```
3. Click **Deploy → New deployment → Web app** (*Execute as: Me*, *Who has access: Anyone*), then call:
   `GET https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec?secret=<YOUR_WEBHOOK_SECRET>`

## 📄 License
[MIT License](./LICENSE)
