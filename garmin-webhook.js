/**
 * 🌐 Serverless Webhook Entrypoint for External AI Agents (n8n / Dify / ChatGPT / Custom Agents)
 * -----------------------------------------------------------------------------------------------
 * Add this file alongside `garmin-health.js` in a standalone Google Apps Script project,
 * then Deploy -> New deployment -> Web app (Execute as: Me, Who has access: Anyone).
 *
 * Requires Script Properties:
 *   - GARMIN_PERSONAL_API_KEY
 *   - WEBHOOK_SECRET (strong random token to protect your health endpoint)
 *
 * Usage:
 *   GET https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec?secret=<WEBHOOK_SECRET>
 *   GET https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec?secret=<WEBHOOK_SECRET>&mode=full
 */

function doGet(e) {
  const secret = PropertiesService.getScriptProperties().getProperty('WEBHOOK_SECRET');
  if (!secret || e?.parameter?.secret !== secret) {
    return ContentService.createTextOutput(JSON.stringify({
      ok: false,
      error: 'Unauthorized'
    })).setMimeType(ContentService.MimeType.JSON);
  }

  const mode = (e?.parameter?.mode || 'summary').toLowerCase();
  const context = mode === 'full' ? getGarminFullContext() : getGarminSummary();

  return ContentService.createTextOutput(JSON.stringify({
    ok: true,
    mode: mode === 'full' ? 'full' : 'summary',
    summary: context
  })).setMimeType(ContentService.MimeType.JSON);
}
