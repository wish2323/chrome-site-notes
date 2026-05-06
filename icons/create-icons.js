#!/usr/bin/env node
// 외부 의존성 없이 PNG 아이콘 생성 (Node.js 내장 모듈만 사용)
'use strict';

const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

// ─── CRC32 ───────────────────────────────────────────────────────────────────
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ─── PNG 청크 생성 ────────────────────────────────────────────────────────────
function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const dataBuf = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const lenBuf = Buffer.allocUnsafe(4);
  lenBuf.writeUInt32BE(dataBuf.length, 0);
  const crcBuf = Buffer.allocUnsafe(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, dataBuf])), 0);
  return Buffer.concat([lenBuf, typeBuf, dataBuf, crcBuf]);
}

// ─── PNG 생성 ─────────────────────────────────────────────────────────────────
function makePNG(size, pixelFn) {
  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  ihdr[10] = ihdr[11] = ihdr[12] = 0;

  const stride = 1 + size * 4;
  const raw = Buffer.allocUnsafe(size * stride);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // filter: None
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixelFn(x, y, size);
      const o = y * stride + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }

  const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    PNG_SIG,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ─── 아이콘 드로잉 (인디고 배경 + 흰색 줄 3개) ───────────────────────────────
function inRoundedRect(x, y, size, r) {
  const pad = Math.round(size * 0.06);
  const x0 = pad, y0 = pad, x1 = size - 1 - pad, y1 = size - 1 - pad;
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;

  // 4개 모서리 곡률 체크
  const corners = [
    [x0 + r, y0 + r, x <= x0 + r, y <= y0 + r],
    [x1 - r, y0 + r, x >= x1 - r, y <= y0 + r],
    [x0 + r, y1 - r, x <= x0 + r, y >= y1 - r],
    [x1 - r, y1 - r, x >= x1 - r, y >= y1 - r],
  ];
  for (const [cx, cy, inX, inY] of corners) {
    if (inX && inY && (x - cx) ** 2 + (y - cy) ** 2 > r ** 2) return false;
  }
  return true;
}

function drawIcon(x, y, size) {
  const radius = Math.round(size * 0.22);
  if (!inRoundedRect(x, y, size, radius)) return [0, 0, 0, 0];

  // 가로줄 3개 (텍스트 표현)
  const lx0 = Math.round(size * 0.24);
  const lx1 = Math.round(size * 0.76);
  const lx1s = Math.round(size * 0.58); // 마지막 줄은 짧게
  const lh = Math.max(1, Math.round(size * 0.075));
  const lines = [0.30, 0.50, 0.68].map(p => Math.round(size * p));

  for (let i = 0; i < lines.length; i++) {
    const ly = lines[i];
    const lEnd = i === lines.length - 1 ? lx1s : lx1;
    if (y >= ly && y < ly + lh && x >= lx0 && x < lEnd) {
      return [255, 255, 255, 215];
    }
  }

  return [99, 102, 241, 255]; // indigo-500
}

// ─── 생성 ─────────────────────────────────────────────────────────────────────
const outDir = __dirname;

for (const size of [16, 48, 128]) {
  const png = makePNG(size, drawIcon);
  const outPath = path.join(outDir, `icon${size}.png`);
  fs.writeFileSync(outPath, png);
  console.log(`✓ icons/icon${size}.png (${size}×${size})`);
}
