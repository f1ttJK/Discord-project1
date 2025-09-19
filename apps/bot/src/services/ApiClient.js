"use strict";

const { request } = require("undici");
const { getApiEnv } = require("../utils/api/env");

/**
 * Minimal REST client for talking to our API with service token
 */
async function apiRequest(path, { method = "GET", body } = {}) {
  const env = getApiEnv();
  const url = `${env.baseUrl.replace(/\/$/, "")}${path}`;
  const headers = {
    "Authorization": `Bearer ${env.serviceToken}`,
  };

  const maxAttempts = Math.max(1, env.maxRetries + 1);
  let attempt = 0;
  let lastErr;

  while (attempt < maxAttempts) {
    attempt++;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error("API_REQUEST_TIMEOUT")), env.timeoutMs);
    try {
      const res = await request(url, {
        method,
        headers: body ? { ...headers, "Content-Type": "application/json" } : headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      // Retry on 502/503/504 and handle 429 Retry-After
      if (res.statusCode === 429) {
        const retryAfter = Number(res.headers["retry-after"]) || 0;
        const delayMs = (retryAfter > 0 ? retryAfter * 1000 : backoffMs(env, attempt));
        await sleep(delayMs);
        continue;
      }
      if ([502, 503, 504].includes(res.statusCode) && attempt < maxAttempts) {
        await sleep(backoffMs(env, attempt));
        continue;
      }

      const text = await res.body.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch (_) {}

      if (res.statusCode >= 400) {
        const code = data?.error?.code || "API_ERROR";
        const msg = data?.error?.message || `API ${res.statusCode}`;
        const err = new Error(`${code}: ${msg}`);
        err.status = res.statusCode;
        err.code = code;
        err.details = data?.error?.details;
        throw err;
      }
      return data;
    } catch (err) {
      clearTimeout(timeout);
      lastErr = err;
      // Retry on abort/network errors
      const retriable = err.name === 'AbortError' || err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED' || err.code === 'EAI_AGAIN';
      if (retriable && attempt < maxAttempts) {
        await sleep(backoffMs(env, attempt));
        continue;
      }
      throw err;
    }
  }
  throw lastErr || new Error("API request failed");
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function backoffMs(env, attempt) {
  const base = env.retryBaseMs * Math.pow(2, attempt - 1);
  const jitter = Math.floor(Math.random() * env.retryBaseMs);
  return Math.min(base + jitter, 10_000);
}

module.exports = { apiRequest };
