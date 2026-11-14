# 🚀 別再架 Docker 跟 Python 了！雙版本免伺服器 Garmin 體徵外掛 (GAS)

> [English](./README.md) | 繁體中文

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Google Apps Script](https://img.shields.io/badge/Runtime-Google%20Apps%20Script-green.svg)](#)
[![Garmin Personal API](https://img.shields.io/badge/API-Garmin%20Personal%20API-007cc3.svg)](https://developer.garmin.com/gc-developer-program/personal/)

透過 **Garmin Personal API** 自動抓取步數、靜息心率、壓力、身體電量、消耗卡路里、睡眠、HRV 與最近運動，**100% 免費跑在 Google Apps Script (GAS)**，不用養主機也不用架 Docker！

本專案提供 **兩種獨立用法版本**：

| 版本 | 使用檔案 | 適用情境 |
| :--- | :--- | :--- |
| **1. LINE Bot 內嵌版** | [`garmin-health.js`](./garmin-health.js) | 直接放進現有 LINE Bot / GAS 專案，無 `doGet` 撞名風險，一行塞進 System Prompt |
| **2. Serverless 伺服器版** | [`garmin-health.js`](./garmin-health.js) + [`garmin-webhook.js`](./garmin-webhook.js) | 部署成獨立免費 HTTPS Webhook API，給 **n8n、Make、Dify、Coze、ChatGPT 或其他 AI 代理** 呼叫 |

---

## ✨ 核心特色
- **自動換約快取**：Token 快取 6 小時，遇到 `401` 自動刷新重試。
- **低負載設計**：體徵數據快取 15 分鐘，不頻繁敲擊 Garmin 伺服器。
- **雙輸出模式可選**：
  - `getGarminSummary()`（輕量版）：`[2026-11-14] 步數 6500｜靜息心率 58｜壓力 22｜身體電量 78/95`
  - `getGarminFullContext()`（旗艦版）：`[2026-11-14] 步數 6500｜消耗 2100 kcal｜電量 78/95｜昨晚睡眠 7.2h (82分)｜HRV 55 ms (BALANCED)｜最近運動: Strength 55min`

## 🔌 已核對的官方 Garmin Personal API 端點
- `POST /personalapitoken-service/personal-api/personal-api-key/token` — 換取 Bearer Token
- `GET /usersummary-service/v2/dailysummaries?startDate=...&endDate=...` — 步數、靜息心率、壓力、卡路里、身體電量
- `GET /sleep-service/sleep/dailySleep?date=...` — 睡眠時長與分數
- `GET /hrv-service/hrv/daily/{fromDate}/{toDate}` — 夜間 HRV 均值與狀態
- `GET /activitylist-service/activities/search/activities?start=0&limit=1` — 最近一筆運動紀錄

---

## 🔑 事前準備
1. 前往 **Garmin Connect 網頁版 ➔ 設定 ➔ Personal API Key** 產生你的 `GARMIN_PERSONAL_API_KEY`。
2. 在 Google Apps Script 的「專案設定 ➔ 指令碼屬性」中新增：
   - 屬性名稱：`GARMIN_PERSONAL_API_KEY`
   - 屬性值：你的 API Key

---

## 🤖 版本一：LINE Bot / GAS 內嵌版

1. 將 [`garmin-health.js`](./garmin-health.js) 直接貼進你原本的 LINE Bot GAS 專案（刻意不含 `doGet`/`doPost`，不會跟原本的 Webhook 入口衝突）。
2. 在你的 LLM 呼叫鏈注入 System Prompt：

```javascript
// 輕量版（步數、靜息心率、壓力、身體電量）
const healthContext = getGarminSummary();

// 或旗艦版（多抓卡路里、睡眠、HRV、最近運動）
// const healthContext = getGarminFullContext();

systemPrompt += `\n\n[使用者即時生理狀態]\n${healthContext}`;
```

---

## 🌐 版本二：Serverless Webhook 伺服器版（給外部 AI 代理用）

把 GAS 部署成免費的無狀態 HTTPS 伺服器：

1. 新建一個獨立的 Google Apps Script 專案，同時放入 [`garmin-health.js`](./garmin-health.js) 與 [`garmin-webhook.js`](./garmin-webhook.js)。
2. 在「專案設定 ➔ 指令碼屬性」設定兩組屬性：
   - `GARMIN_PERSONAL_API_KEY`：你的 Garmin API Key
   - `WEBHOOK_SECRET`：自訂高強度隨機密碼（防止陌生人讀取你的體徵）
3. 點右上角 **部署 ➔ 新增部署 ➔ 網頁應用程式**（執行身分：`我`、誰可以存取：`所有人`）。
4. 之後任何外部 AI 代理或自動化工具都能直接呼叫：
   - 輕量版：
     `GET https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec?secret=<你的WEBHOOK_SECRET>`
   - 旗艦版（含睡眠、HRV、卡路里、最近運動）：
     `GET https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec?secret=<你的WEBHOOK_SECRET>&mode=full`

回傳 JSON 範例：
```json
{
  "ok": true,
  "mode": "summary",
  "summary": "[2026-11-14] 步數 6500｜靜息心率 58｜壓力 22｜身體電量 78/95"
}
```

## 📄 License
[MIT License](./LICENSE)
