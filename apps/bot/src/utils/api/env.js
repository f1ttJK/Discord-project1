"use strict";

let cached;
function getApiEnv() {
  if (cached) return cached;
  const baseUrl = process.env.API_BASE_URL || "http://localhost:4000";
  const serviceToken = process.env.API_SERVICE_TOKEN || process.env.API_TOKEN;
  if (!serviceToken) {
    throw new Error("Missing API service token. Set API_SERVICE_TOKEN in environment.");
  }
  const timeoutEnv = process.env.API_REQUEST_TIMEOUT_MS;
  const timeoutMs = Number(timeoutEnv === null || timeoutEnv === undefined ? 15000 : timeoutEnv);
  const retriesEnv = process.env.API_MAX_RETRIES;
  const maxRetries = Number(retriesEnv === null || retriesEnv === undefined ? 3 : retriesEnv);
  const retryBaseEnv = process.env.API_RETRY_BASE_MS;
  const retryBaseMs = Number(retryBaseEnv === null || retryBaseEnv === undefined ? 250 : retryBaseEnv);
  cached = { baseUrl, serviceToken, timeoutMs, maxRetries, retryBaseMs };
  return cached;
}

module.exports = { getApiEnv };
