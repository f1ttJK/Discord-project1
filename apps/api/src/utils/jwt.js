"use strict";

const crypto = require("crypto");

function base64url(input) {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64urlJson(obj) {
  return base64url(JSON.stringify(obj));
}

/**
 * Sign a minimal JWT (HS256)
 * @param {object} payload
 * @param {string} secret
 * @param {number} expiresInSec
 * @returns {string}
 */
function sign(payload, secret, expiresInSec = 3600) {
  const header = { alg: "HS256", typ: "JWT" };
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + Math.max(1, Number(expiresInSec || 0));
  const body = { ...payload, iat, exp };
  const data = `${base64urlJson(header)}.${base64urlJson(body)}`;
  const sig = crypto.createHmac("sha256", secret).update(data).digest("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${data}.${sig}`;
}

/**
 * Verify HS256 JWT and return payload or null
 * @param {string} token
 * @param {string} secret
 * @returns {object|null}
 */
function verify(token, secret) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const data = `${h}.${p}`;
  const expected = crypto.createHmac("sha256", secret).update(data).digest("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  if (s !== expected) return null;
  try {
    const payload = JSON.parse(Buffer.from(p.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === "number" && payload.exp < now) return null;
    return payload;
  } catch {
    return null;
  }
}

module.exports = { sign, verify };
