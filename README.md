# 🚀 Stop Building Garmin MCP Servers — 2 Serverless GAS Versions for Any AI Agent

> English | [繁體中文](./README.zh-TW.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Google Apps Script](https://img.shields.io/badge/Runtime-Google%20Apps%20Script-green.svg)](#)
[![Garmin Personal API](https://img.shields.io/badge/API-Garmin%20Personal%20API-007cc3.svg)](https://developer.garmin.com/gc-developer-program/personal/)

Pull real-time health metrics from the official **Garmin Personal API** — **Steps, RHR, Stress, Body Battery, Calories, Sleep, HRV, and Recent Workouts** — using **100% free, zero-server Google Apps Script**.

This repo provides **two ready-to-use versions** depending on your architecture:

| Version | Files | Best For |
| :--- | :--- | :--- |
| **1. LINE Bot / Direct GAS** | [`garmin-health.js`](./garmin-health.js) | Injecting health context directly into your LINE Bot / GAS LLM `systemPrompt` (no `doGet` conflict) |
| **2. Serverless Webhook API** | [`garmin-health.js`](./garmin-health.js) + [`garmin-webhook.js`](./garmin-webhook.js) | Exposing a free HTTPS JSON endpoint for **n8n, Make, Dify, Coze, ChatGPT Actions, or external AI agents** |

---

## ✨ Features & Sample Outputs
- **Auto-Refreshing Token Cache**: Caches the Bearer token for 6 hours and automatically retries on HTTP `401`.
- **Low-Overhead Polling**: Caches health summaries for 15 minutes to respect Garmin rate limits.
- **Two Output Modes**:
  - `getGarminSummary()` (Lightweight):  
    `[2026-11-14] Steps 6500 | RHR 58 | Stress 22 | Body Battery 78/95`
  - `getGarminFullContext()` (Flagship):  
    `[2026-11-14] Steps 6500 | Burned 2100 kcal | Body Battery 78/95 | Sleep 7.2h (Score 82) | HRV 55 ms (BALANCED) | Recent Workout: Strength 55min`

## 🔌 Verified Garmin Personal API Endpoints Used
- `POST /personalapitoken-service/personal-api/personal-api-key/token` — Exchange API key for Bearer token
- `GET /usersummary-service/v2/dailysummaries?startDate=...&endDate=...` — Steps, RHR, Stress, Calories, Body Battery
- `GET /sleep-service/sleep/dailySleep?date=...` — Sleep duration & overall sleep score
- `GET /hrv-service/hrv/daily/{fromDate}/{toDate}` — Overnight HRV average & status
- `GET /activitylist-service/activities/search/activities?start=0&limit=1` — Latest workout summary

---

## 🔑 Prerequisites
1. Generate your personal `GARMIN_PERSONAL_API_KEY` from **Garmin Connect Web → Settings → Personal API Key**.
2. In your Google Apps Script project, go to **Project Settings → Script Properties** and add:
   - `GARMIN_PERSONAL_API_KEY`: `<your-api-key>`

---

## 🤖 Version 1: LINE Bot / Direct GAS Integration

1. Copy [`garmin-health.js`](./garmin-health.js) into your existing LINE Bot GAS project (it intentionally omits `doGet`/`doPost` so it won't collide with your bot's webhook).
2. Inject it into your LLM System Prompt:

```javascript
// Lightweight mode (Steps, RHR, Stress, Body Battery)
const healthContext = getGarminSummary();

// Or Flagship mode (adds Calories, Sleep, HRV, Recent Workout)
// const healthContext = getGarminFullContext();

systemPrompt += `\n\n[User Real-Time Biometrics]\n${healthContext}`;
```

---

## 🌐 Version 2: Serverless Webhook Server (for External AI Agents)

Turn GAS into a $0 stateless HTTPS API server:

1. Create a standalone Google Apps Script project and add both [`garmin-health.js`](./garmin-health.js) and [`garmin-webhook.js`](./garmin-webhook.js).
2. In **Project Settings → Script Properties**, add:
   - `GARMIN_PERSONAL_API_KEY`: `<your-api-key>`
   - `WEBHOOK_SECRET`: `<a-strong-random-token>`
3. Click **Deploy → New deployment → Web app** (*Execute as: Me*, *Who has access: Anyone*).
4. Call your endpoint from n8n, Dify, ChatGPT Actions, or any agent:
   - Lightweight brief:
     `GET https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec?secret=<WEBHOOK_SECRET>`
   - Full flagship context (Sleep + HRV + Calories + Workout):
     `GET https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec?secret=<WEBHOOK_SECRET>&mode=full`

Example JSON response:
```json
{
  "ok": true,
  "mode": "summary",
  "summary": "[2026-11-14] Steps 6500 | RHR 58 | Stress 22 | Body Battery 78/95"
}
```

> Note: Adjust `tz` (default `Asia/Taipei`) and output labels in [`garmin-health.js`](./garmin-health.js) to match your preferred timezone and language.

## 📄 License
[MIT License](./LICENSE)
