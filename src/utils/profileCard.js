// src/utils/profileCard.js
const fs = require('fs').promises
const path = require('path')
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas')
const https = require('https')
const { parse: parseTwemoji } = require('twemoji-parser')

function drawRoundedRect(ctx, x, y, w, h, r = 10) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + w - radius, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius)
  ctx.lineTo(x + w, y + h - radius)
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
  ctx.lineTo(x + radius, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}

function formatNumber(n) {
  try {
    return new Intl.NumberFormat('uk-UA').format(n ?? 0)
  } catch {
    return String(n ?? 0)
  }
}

// Two-tone where RIGHT segment is colored, LEFT is white
function drawFittedCenteredTwoToneRightColor(ctx, leftText, rightText, rightColor, boxX, boxY, boxW, boxH, family, max=20, min=14) {
  const maxWidth = boxW - 16
  let fontSize = min
  for (let sz = max; sz >= min; sz--) {
    ctx.font = `600 ${sz}px ${family}`
    const totalW = ctx.measureText(leftText + rightText).width
    if (totalW <= maxWidth) { fontSize = sz; break }
  }
  ctx.font = `600 ${fontSize}px ${family}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  const cy = boxY + boxH / 2
  const totalW = ctx.measureText(leftText + rightText).width
  let x = boxX + (boxW - totalW) / 2
  // left in white
  ctx.fillStyle = '#FFFFFF'
  ctx.fillText(leftText, x, cy)
  x += ctx.measureText(leftText).width
  // right in sampled color
  ctx.fillStyle = rightColor
  ctx.fillText(rightText, x, cy)
}

function pluralUA(n, one, few, many) {
  const n10 = n % 10
  const n100 = n % 100
  if (n10 === 1 && n100 !== 11) return one
  if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return few
  return many
}

function formatJoinedDurationUA(joinMs, nowMs = Date.now()) {
  if (!joinMs) return ''
  let diff = Math.max(0, Math.floor((nowMs - joinMs) / 1000)) // seconds
  const year = Math.floor(diff / (365 * 24 * 3600)); if (year >= 1) return `${year} ${pluralUA(year, 'рiк', 'роки', 'рокiв')}`
  const month = Math.floor(diff / (30 * 24 * 3600)); if (month >= 1) return `${month} ${pluralUA(month, 'мiсяць', 'мiсяцi', 'мiсяцiв')}`
  const week = Math.floor(diff / (7 * 24 * 3600)); if (week >= 1) return `${week} ${pluralUA(week, 'недiля', 'недiлi', 'недiль')}`
  const day = Math.floor(diff / (24 * 3600)); if (day >= 1) return `${day} ${pluralUA(day, 'день', 'днi', 'днiв')}`
  const hour = Math.floor(diff / 3600); if (hour >= 1) return `${hour} ${pluralUA(hour, 'година', 'години', 'годин')}`
  const minute = Math.floor(diff / 60); if (minute >= 1) return `${minute} ${pluralUA(minute, 'хвилина', 'хвилини', 'хвилин')}`
  const second = diff; return `${second} ${pluralUA(second, 'секунда', 'секунди', 'секунд')}`
}

// Split text tokens by spaces to allow word-wrapping
function explodeTokensBySpaces(tokens) {
  const out = []
  for (const t of tokens) {
    if (t.type === 'emoji') { out.push(t); continue }
    const parts = (t.text || '').split(/(\s+)/)
    for (const p of parts) {
      if (p === '') continue
      out.push({ type: 'text', text: p })
    }
  }
  return out
}

function layoutTokensIntoLines(ctx, tokens, emojiSize, maxWidth, maxLines = 2) {
  const lines = [[]]
  let currentWidth = 0
  const pushNewLine = () => { lines.push([]); currentWidth = 0 }
  const measure = (tok) => tok.type === 'emoji' ? emojiSize : ctx.measureText(tok.text).width

  for (const tok of tokens) {
    const w = measure(tok)
    if (currentWidth + w <= maxWidth || lines[lines.length - 1].length === 0) {
      lines[lines.length - 1].push(tok)
      currentWidth += w
      continue
    }
    if (lines.length >= maxLines) {
      // Truncate last line with ellipsis
      const lastLine = lines[lines.length - 1]
      // Try to shrink the last text token
      for (let i = lastLine.length - 1; i >= 0; i--) {
        const lt = lastLine[i]
        if (lt.type === 'text' && lt.text.trim()) {
          const ellipsis = '…'
          let text = lt.text
          // remove while overflow
          while (text.length > 0) {
            text = text.slice(0, -1)
            const cand = text + ellipsis
            const replaced = [...lastLine.slice(0, i), { type: 'text', text: cand }]
            const width = measureTokensWidth(ctx, replaced, emojiSize)
            if (width <= maxWidth) {
              lines[lines.length - 1] = replaced
              return lines
            }
          }
        }
      }
      return lines
    }
    pushNewLine()
    lines[lines.length - 1].push(tok)
    currentWidth = w
  }
  return lines
}

async function drawTokensMultilineCentered(ctx, text, boxX, boxY, boxW, boxH, family, max=16, min=12) {
  const rawTokens = tokenizeDisplay(String(text || ''))
  // Choose font size that fits in width and up to 2 lines of height
  let fontSize = min
  for (let sz = max; sz >= min; sz--) {
    ctx.font = `400 ${sz}px ${family}`
    const exploded = explodeTokensBySpaces(rawTokens)
    const lines = layoutTokensIntoLines(ctx, exploded, sz, boxW - 4, 2)
    const lineHeight = sz + 2
    const totalH = lineHeight * lines.length
    if (totalH <= boxH) { fontSize = sz; break }
  }
  ctx.font = `400 ${fontSize}px ${family}`
  const exploded = explodeTokensBySpaces(rawTokens)
  const lines = layoutTokensIntoLines(ctx, exploded, fontSize, boxW - 4, 2)
  const lineHeight = fontSize + 2
  const totalH = lineHeight * lines.length
  let cy = Math.round(boxY + (boxH - totalH) / 2 + lineHeight / 2)
  for (const line of lines) {
    const w = measureTokensWidth(ctx, line, fontSize)
    const startX = Math.round(boxX + (boxW - w) / 2)
    await drawTokens(ctx, line, startX, cy, fontSize)
    cy += lineHeight
  }
}

// Rounded only on the left side
function drawRoundedRectLeft(ctx, x, y, w, h, r = 10) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + w, y)
  ctx.lineTo(x + radius, y)
  ctx.quadraticCurveTo(x, y, x, y + radius)
  ctx.lineTo(x, y + h - radius)
  ctx.quadraticCurveTo(x, y + h, x + radius, y + h)
  ctx.lineTo(x + w, y + h)
  ctx.lineTo(x + w, y)
  ctx.closePath()
}

// Rounded only on the right side
function drawRoundedRectRight(ctx, x, y, w, h, r = 10) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x + w - radius, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius)
  ctx.lineTo(x + w, y + h - radius)
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
  ctx.lineTo(x, y + h)
  ctx.lineTo(x, y)
  ctx.closePath()
}

function fitText(ctx, text, maxWidth) {
  if (!text) return ''
  if (ctx.measureText(text).width <= maxWidth) return text
  const ellipsis = '…'
  let lo = 0, hi = text.length
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2)
    const candidate = text.slice(0, mid) + ellipsis
    if (ctx.measureText(candidate).width <= maxWidth) lo = mid + 1
    else hi = mid
  }
  const finalText = text.slice(0, Math.max(hi - 1, 0)) + ellipsis
  return finalText
}

// Convert a string into tokens of text and emoji images
function tokenizeDisplay(text) {
  const tokens = []
  const parsed = parseTwemoji(text || '')
  if (!parsed.length) return [{ type: 'text', text: text || '' }]
  let cursor = 0
  for (const p of parsed) {
    if (p.indices[0] > cursor) {
      tokens.push({ type: 'text', text: text.slice(cursor, p.indices[0]) })
    }
    // p.url is a CDN link to emoji image
    tokens.push({ type: 'emoji', url: p.url })
    cursor = p.indices[1]
  }
  if (cursor < text.length) tokens.push({ type: 'text', text: text.slice(cursor) })
  return tokens
}

function measureTokensWidth(ctx, tokens, emojiSize) {
  let w = 0
  for (const t of tokens) {
    if (t.type === 'text') w += ctx.measureText(t.text).width
    else w += emojiSize
  }
  return w
}

function truncateTokensToWidth(ctx, tokens, emojiSize, maxWidth) {
  // If already fits, return as is
  if (measureTokensWidth(ctx, tokens, emojiSize) <= maxWidth) return tokens
  const result = []
  let w = 0
  const ellipsis = '…'
  for (const t of tokens) {
    if (t.type === 'emoji') {
      if (w + emojiSize > maxWidth) break
      result.push(t)
      w += emojiSize
      continue
    }
    // text: try to fit progressively
    let text = t.text
    if (!text) continue
    for (let i = 0; i < text.length; i++) {
      const candidate = text.slice(0, i + 1)
      const cw = ctx.measureText(candidate + ellipsis).width
      if (w + cw > maxWidth) {
        // stop before overflow
        const trimmed = text.slice(0, i)
        if (trimmed) result.push({ type: 'text', text: trimmed + ellipsis })
        return result
      }
    }
    // whole token fits with room for at least ellipsis check above
    result.push({ type: 'text', text })
    w += ctx.measureText(text).width
  }
  return result
}

async function drawTokens(ctx, tokens, startX, centerY, emojiSize) {
  // ensure left alignment for token-by-token drawing
  ctx.save()
  const prevAlign = ctx.textAlign
  ctx.textAlign = 'left'
  let x = Math.round(startX)
  for (const t of tokens) {
    if (t.type === 'text') {
      ctx.fillText(t.text, x, centerY)
      x += ctx.measureText(t.text).width
    } else {
      try {
        const img = await loadImage(t.url)
        ctx.drawImage(img, x, centerY - emojiSize / 2, emojiSize, emojiSize)
        x += emojiSize
      } catch {
        // ignore emoji draw failure
      }
    }
  }
  ctx.textAlign = prevAlign
  ctx.restore()
}

function formatHMS(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (v) => String(v).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(sec)}`
}

function formatVoiceLine(totalSeconds, topRank) {
  const s = Math.max(0, Math.floor(totalSeconds || 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  let topText = '—'
  if (typeof topRank === 'number' && topRank > 0) {
    topText = topRank > 99 ? '99+' : String(topRank)
  }
  return `#${topText} | ${h} год. ${m} хв.`
}

function drawFittedCenteredText(ctx, text, boxX, boxY, boxW, boxH, family, max=20, min=14) {
  const maxWidth = boxW - 16
  let fontSize = min
  for (let sz = max; sz >= min; sz--) {
    ctx.font = `600 ${sz}px ${family}`
    if (ctx.measureText(text).width <= maxWidth) { fontSize = sz; break }
  }
  ctx.font = `600 ${fontSize}px ${family}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const cx = boxX + boxW / 2
  const cy = boxY + boxH / 2
  ctx.fillText(text, cx, cy)
}

function sampleCanvasColor(ctx, x, y) {
  const d = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data
  // Respect alpha if present; default to 1
  const a = (d[3] ?? 255) / 255
  return `rgba(${d[0]}, ${d[1]}, ${d[2]}, ${a})`
}

function drawFittedCenteredTwoTone(ctx, leftText, rightText, leftColor, boxX, boxY, boxW, boxH, family, max=20, min=14) {
  const maxWidth = boxW - 16
  let fontSize = min
  for (let sz = max; sz >= min; sz--) {
    ctx.font = `600 ${sz}px ${family}`
    const totalW = ctx.measureText(leftText + rightText).width
    if (totalW <= maxWidth) { fontSize = sz; break }
  }
  ctx.font = `600 ${fontSize}px ${family}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  const cy = boxY + boxH / 2
  const totalW = ctx.measureText(leftText + rightText).width
  let x = boxX + (boxW - totalW) / 2
  // draw left segment in sampled color
  ctx.fillStyle = leftColor
  ctx.fillText(leftText, x, cy)
  x += ctx.measureText(leftText).width
  // draw right segment in white
  ctx.fillStyle = '#FFFFFF'
  ctx.fillText(rightText, x, cy)
}

// helpers for role color drawing
function normalizeHex(color) {
  if (!color) return '#808080'
  if (typeof color === 'number') {
    return `#${color.toString(16).padStart(6, '0')}`
  }
  let s = String(color).trim()
  if (!s.startsWith('#')) s = `#${s}`
  if (s.length === 4) {
    // expand #rgb -> #rrggbb
    s = `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`
  }
  return s.slice(0, 7)
}

function hexToRgb(hex) {
  const s = normalizeHex(hex).replace('#', '')
  const r = parseInt(s.slice(0, 2), 16)
  const g = parseInt(s.slice(2, 4), 16)
  const b = parseInt(s.slice(4, 6), 16)
  return { r, g, b }
}

function drawFittedLeft(ctx, text, boxX, boxY, boxW, boxH, family, max=20, min=14, weight='600') {
  const maxWidth = boxW - 4
  let fontSize = min
  for (let sz = max; sz >= min; sz--) {
    ctx.font = `${weight} ${sz}px ${family}`
    const w = ctx.measureText(text).width
    if (w <= maxWidth) { fontSize = sz; break }
  }
  ctx.font = `${weight} ${fontSize}px ${family}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  const cy = boxY + boxH / 2
  ctx.fillText(text, boxX, cy)
}

function drawFittedCenteredInBox(ctx, text, boxX, boxY, boxW, boxH, family, max=20, min=12, weight='400') {
  const maxWidth = boxW - 4
  let fontSize = min
  for (let sz = max; sz >= min; sz--) {
    ctx.font = `${weight} ${sz}px ${family}`
    const w = ctx.measureText(text).width
    if (w <= maxWidth) { fontSize = sz; break }
  }
  ctx.font = `${weight} ${fontSize}px ${family}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  const cy = boxY + boxH / 2
  const w = ctx.measureText(text).width
  const startX = boxX + Math.max(0, (boxW - w) / 2)
  ctx.fillText(text, startX, cy)
}

async function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          // handle redirects
          return resolve(fetchBuffer(res.headers.location))
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode} while fetching ${url}`))
        }
        const chunks = []
        res.on('data', (d) => chunks.push(d))
        res.on('end', () => resolve(Buffer.concat(chunks)))
      })
      .on('error', reject)
  })
}

/**
 * Рендерит карточку с аватаром пользователя на красном фоне.
 * Аватар: позиция x=16, y=0, размер 188x188.
 * @param {{ avatarUrl?: string, displayName?: string }} opts
 * @returns {Promise<Buffer>} PNG buffer
 */
async function renderCard(opts = {}) {
  // Try to register Montserrat-SemiBold font if available
  try {
    const fontPath = path.resolve(__dirname, 'assets', 'fonts', 'Montserrat-SemiBold.ttf')
    if (!GlobalFonts.has('Montserrat SemiBold')) {
      GlobalFonts.registerFromPath(fontPath, 'Montserrat SemiBold')
    }
  } catch (_) {
    // ignore if font is missing; will fallback to system font
  }
  const bgPath = path.resolve(__dirname, 'assets', 'backgrounds', 'bg_red.png')
  const bg = await loadImage(await fs.readFile(bgPath))

  // Force card size to 900x360
  const canvas = createCanvas(900, 360)
  const ctx = canvas.getContext('2d')

  // draw background
  ctx.drawImage(bg, 0, 0, canvas.width, canvas.height)

  // draw textbox (195x58) at x=15,y=0
  const tbX = 56
  const tbY = 262
  const tbW = 195
  const tbH = 58
  ctx.save()
  drawRoundedRect(ctx, tbX, tbY, tbW, tbH, 12)
  ctx.fillStyle = 'rgba(0,0,0,0)'
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = 'rgba(255, 255, 255, 0)'
  ctx.stroke()
  ctx.restore()

  // draw display name inside textbox (centered, supports emojis)
  ctx.save()
  ctx.fillStyle = '#FFFFFF'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.shadowColor = 'rgba(0, 0, 0, 0)'
  ctx.shadowBlur = 4

  const centerX = tbX + tbW / 2
  const centerY = tbY + tbH / 2
  const maxTextWidth = tbW - 16 // horizontal padding total

  // choose font size between 20 and 14 to fit width
  const family = GlobalFonts.has('Montserrat SemiBold')
    ? '"Montserrat SemiBold"'
    : '"Segoe UI", Arial, Helvetica, sans-serif'

  let fontSize = 20
  const rawText = (opts.displayName || '').trim()
  let tokens = tokenizeDisplay(rawText)
  // Find the largest font size where tokens width fits into maxTextWidth
  fontSize = 14 // default to min
  for (let sz = 20; sz >= 14; sz--) {
    ctx.font = `600 ${sz}px ${family}`
    const w = measureTokensWidth(ctx, tokens, sz)
    if (w <= maxTextWidth) {
      fontSize = sz
      break
    }
  }
  ctx.font = `600 ${fontSize}px ${family}`
  let toDraw = tokens
  let totalWidth = measureTokensWidth(ctx, toDraw, fontSize)
  // If even at 14 it doesn't fit, truncate with ellipsis
  if (totalWidth > maxTextWidth && fontSize === 14) {
    toDraw = truncateTokensToWidth(ctx, tokens, fontSize, maxTextWidth)
    totalWidth = measureTokensWidth(ctx, toDraw, fontSize)
  }
  const startX = centerX - totalWidth / 2
  await drawTokens(ctx, toDraw, startX, centerY, fontSize)
  ctx.restore()

  // Highest role badge
  if (opts.roleName) {
    const hasIcon = Boolean(opts.roleIconUrl)
    const iconBox = { x: 330, y: 169, w: 44, h: 44 }
    const roleBox = hasIcon
      ? { x: 377, y: 169, w: 183, h: 44 }
      : { x: 350, y: 169, w: 190, h: 44 }
    // Resolve role color; if none or black ('#000000'), fallback to rgba(153,170,181,255)
    let rc = opts.roleColor
    const norm = rc ? normalizeHex(rc) : undefined
    let r, g, b
    if (!norm || norm === '#000000') {
      r = 153; g = 170; b = 181
    } else {
      const rgb = hexToRgb(norm)
      r = rgb.r; g = rgb.g; b = rgb.b
    }
    // background at 25% opacity
    ctx.save()
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.25)`
    if (hasIcon) {
      // Draw icon background with LEFT-only rounding (swapped sides)
      drawRoundedRectLeft(ctx, iconBox.x, iconBox.y, iconBox.w, iconBox.h, 10)
      ctx.fill()
      // Draw role text background with RIGHT-only rounding (swapped)
      ctx.beginPath()
      drawRoundedRectRight(ctx, roleBox.x, roleBox.y, roleBox.w, roleBox.h, 10)
      ctx.fill()
    } else {
      drawRoundedRect(ctx, roleBox.x, roleBox.y, roleBox.w, roleBox.h, 10)
      ctx.fill()
    }
    // @ symbol inside the role box at (15,15) relative to the box (top-left baseline)
    // Font stack with symbol fallback so UTF-8 (включая ★) не превращается в квадраты
    const family = GlobalFonts.has('Montserrat SemiBold')
      ? '"Montserrat SemiBold", "Segoe UI Symbol", "Segoe UI", Arial, Helvetica, sans-serif'
      : '"Segoe UI Symbol", "Segoe UI", Arial, Helvetica, sans-serif'
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    // '@' uses Montserrat SemiBold 12px
    ctx.font = `14px ${family}`
    const atX = roleBox.x + 15
    const atY = roleBox.y + 15
    ctx.fillText('@', atX, atY)
    const atWidth = ctx.measureText('@').width
    // Role name box: 10px to the right of '@', w=130, h=35, vertically centered in role box
    const nameBoxX = Math.round(atX + atWidth + 10)
    const nameBoxY = Math.round(roleBox.y + (roleBox.h - 35) / 2)
    const nameBoxW = 130
    const nameBoxH = 35
    ctx.textBaseline = 'middle'
    // Role name uses Montserrat SemiBold 16 (normal style), centered, supports emojis and wraps to 2 lines
    await drawTokensMultilineCentered(ctx, String(opts.roleName), nameBoxX, nameBoxY, nameBoxW, nameBoxH, family, 16, 12)
    // If icon exists, draw it on top of its background clipped to right-rounded rect
    if (hasIcon) {
      try {
        const img = await loadImage(opts.roleIconUrl)
        // clip to LEFT-rounded path (swapped sides)
        ctx.save()
        drawRoundedRectLeft(ctx, iconBox.x, iconBox.y, iconBox.w, iconBox.h, 10)
        ctx.clip()
        // draw icon reduced to 39x39 centered in the 44x44 tile
        const sz = 39
        const off = (iconBox.w - sz) / 2
        ctx.drawImage(img, Math.round(iconBox.x + off), Math.round(iconBox.y + off), sz, sz)
        ctx.restore()
      } catch {}
    }
    ctx.restore()
  }

  // Activity boxes
  const vBox = { x: 336, y: 267, w: 220, h: 58 }
  const tBox = { x: 625, y: 267, w: 220, h: 58 }

  // backgrounds
  for (const box of [vBox, tBox]) {
    ctx.save()
    drawRoundedRect(ctx, box.x, box.y, box.w, box.h, 12)
    ctx.fillStyle = 'rgba(0,0,0,0)'
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = 'rgba(255, 255, 255, 0)'
    ctx.stroke()
    ctx.restore()
  }

  // text values
  ctx.save()
  ctx.fillStyle = '#FFFFFF'
  ctx.shadowColor = 'rgba(0, 0, 0, 0)'
  ctx.shadowBlur = 4

  // Joined date box (x=320, y=67, w=250, h=67)
  if (opts.joinedTimestamp) {
    const jBox = { x: 320, y: 67, w: 250, h: 36 }
    // background (transparent like others)
    ctx.save()
    drawRoundedRect(ctx, jBox.x, jBox.y, jBox.w, jBox.h, 12)
    ctx.fillStyle = 'rgba(0,0,0,0)'
    ctx.fill()
    ctx.restore()
    // date string dd.mm.yyyy and duration colored as top
    const d = new Date(opts.joinedTimestamp)
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yyyy = d.getFullYear()
    const left = `${dd}.${mm}.${yyyy} |`
    const duration = formatJoinedDurationUA(opts.joinedTimestamp)
    const right = ` ${duration}`
    // font stack incl. symbols
    const familyJoin = GlobalFonts.has('Montserrat SemiBold')
      ? '"Montserrat SemiBold", "Segoe UI Symbol", "Segoe UI", Arial, Helvetica, sans-serif'
      : '"Segoe UI Symbol", "Segoe UI", Arial, Helvetica, sans-serif'
    // use same sampled color as top placements
    const topColor = sampleCanvasColor(ctx, 385, 253)
    drawFittedCenteredTwoToneRightColor(ctx, left, right, topColor, jBox.x, jBox.y, jBox.w, jBox.h, familyJoin, 20, 14)
  }

  // Voice: "#{топ по времени} | {часов} год. {минут} хв." (топ capped at 99+)
  const s = Math.max(0, Math.floor((opts.voiceSeconds || 0)))
  const hours = Math.floor(s / 3600)
  const mins = Math.floor((s % 3600) / 60)
  let topText = '—'
  if (typeof opts.voiceTop === 'number' && opts.voiceTop > 0) {
    topText = opts.voiceTop > 99 ? '99+' : String(opts.voiceTop)
  }
  const leftVoice = `#${topText}`
  const rightVoice = ` | ${hours} год. ${mins} хв.`
  // sample color from x=385, y=253 as requested
  const topColor = sampleCanvasColor(ctx, 385, 253)
  const msgCount = Math.max(0, Math.floor(opts.msgCount || 0))
  let msgTopText = '—'
  if (typeof opts.msgTop === 'number' && opts.msgTop > 0) {
    msgTopText = opts.msgTop > 99 ? '99+' : String(opts.msgTop)
  }
  const leftMsg = `#${msgTopText}`
  const rightMsg = ` | ${msgCount}`

  drawFittedCenteredTwoTone(ctx, leftVoice, rightVoice, topColor, vBox.x, vBox.y, vBox.w, vBox.h, family, 20, 14)
  // Reuse the same sampled color for message top unless different coords are provided
  drawFittedCenteredTwoTone(ctx, leftMsg, rightMsg, topColor, tBox.x, tBox.y, tBox.w, tBox.h, family, 20, 14)

  // Balances: Русраб и Люмiни
  // Font family with symbols
  const familyBal = GlobalFonts.has('Montserrat SemiBold')
    ? '"Montserrat SemiBold", "Segoe UI Symbol", "Segoe UI", Arial, Helvetica, sans-serif'
    : '"Segoe UI Symbol", "Segoe UI", Arial, Helvetica, sans-serif'

  // Русраб balance box: x=665 y=68 w=196 h=36, color #FFD642
  {
    const box = { x: 665, y: 68, w: 196, h: 36 }
    ctx.save()
    drawRoundedRect(ctx, box.x, box.y, box.w, box.h, 12)
    ctx.fillStyle = 'rgba(0,0,0,0)'
    ctx.fill()
    ctx.restore()
    ctx.save()
    ctx.fillStyle = '#FFD642'
    drawFittedCenteredText(ctx, formatNumber(opts.rusrab || 0), box.x, box.y, box.w, box.h, familyBal, 20, 14)
    ctx.restore()
  }

  // Люмiни balance box: x=665 y=128 w=196 h=36, color #FFFFFF
  {
    const box = { x: 665, y: 128, w: 196, h: 36 }
    ctx.save()
    drawRoundedRect(ctx, box.x, box.y, box.w, box.h, 12)
    ctx.fillStyle = 'rgba(0,0,0,0)'
    ctx.fill()
    ctx.restore()
    ctx.save()
    ctx.fillStyle = '#FFFFFF'
    drawFittedCenteredText(ctx, formatNumber(opts.lumini || 0), box.x, box.y, box.w, box.h, familyBal, 20, 14)
    ctx.restore()
  }

  // Топ по валюте Русраб: x=638 y=177 w=194 h=42, "RS | #" (золото) + ранг (белый)
  {
    const box = { x: 638, y: 177, w: 194, h: 42 }
    ctx.save()
    drawRoundedRect(ctx, box.x, box.y, box.w, box.h, 12)
    ctx.fillStyle = 'rgba(0,0,0,0)'
    ctx.fill()
    ctx.restore()
    const left = 'RS | # '
    let rankText = '—'
    if (typeof opts.rusrabTop === 'number' && opts.rusrabTop > 0) {
      rankText = opts.rusrabTop > 10000 ? '10000+' : String(opts.rusrabTop)
    }
    drawFittedCenteredTwoTone(ctx, left, rankText, '#FFD642', box.x, box.y, box.w, box.h, familyBal, 20, 14)
  }
  ctx.restore()

  // draw avatar if provided
  const { avatarUrl } = opts
  if (avatarUrl) {
    try {
      let avatarImg
      try {
        // try direct URL first
        avatarImg = await loadImage(avatarUrl)
      } catch {
        // fallback to fetch buffer (e.g., if URL loading is not supported)
        const buf = await fetchBuffer(avatarUrl)
        avatarImg = await loadImage(buf)
      }
      const x = 56
      const y = 41
      const size = 190
      ctx.save()
      // draw as a circle mask (optional; comment out to keep square)
      ctx.beginPath()
      ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2)
      ctx.closePath()
      ctx.clip()
      ctx.drawImage(avatarImg, x, y, size, size)
      ctx.restore()
    } catch (e) {
      // If avatar fails to load, continue with only background
      // You can add logging here if needed
    }
  }

  return canvas.toBuffer('image/png')
}

module.exports = { renderCard }