// Generates the Tauri bundle icon set with no external dependencies.
//
// The mark is a muted-sage tile with a white six-blade camera aperture.
// Output: src-tauri/icons/{32x32.png,128x128.png,128x128@2x.png,icon.ico}
//
// Run with: node scripts/make-icons.mjs

import { deflateSync, crc32 } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "src-tauri", "icons");

const SAGE = [94, 127, 102];
const WHITE = [255, 255, 255];

function inRoundedRect(x, y, size, radius) {
  const inset = size * 0.06;
  const min = inset;
  const max = size - inset;
  const r = radius;
  const cx = Math.min(Math.max(x, min + r), max - r);
  const cy = Math.min(Math.max(y, min + r), max - r);
  const dx = x - cx;
  const dy = y - cy;
  return x >= min && x <= max && y >= min && y <= max && dx * dx + dy * dy <= r * r;
}

function inTriangle(px, py, a, b, c) {
  const sign = (p1, p2, p3) =>
    (p1[0] - p3[0]) * (p2[1] - p3[1]) - (p2[0] - p3[0]) * (p1[1] - p3[1]);
  const d1 = sign([px, py], a, b);
  const d2 = sign([px, py], b, c);
  const d3 = sign([px, py], c, a);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

function sample(size, x, y) {
  const cx = size / 2;
  const cy = size / 2;
  if (!inRoundedRect(x, y, size, size * 0.22)) return null;

  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.hypot(dx, dy);
  const outer = size * 0.36;
  const inner = size * 0.055;

  if (dist > outer) return SAGE;

  const angle = Math.atan2(dy, dx);
  for (let i = 0; i < 6; i += 1) {
    const base = (Math.PI / 3) * i + Math.PI / 6;
    const spread = 0.62;
    const apex = [cx + inner * Math.cos(base), cy + inner * Math.sin(base)];
    const left = [cx + outer * Math.cos(base - spread), cy + outer * Math.sin(base - spread)];
    const right = [cx + outer * Math.cos(base + spread), cy + outer * Math.sin(base + spread)];
    if (inTriangle(x, y, apex, left, right)) return WHITE;
  }
  return dist < inner ? SAGE : SAGE;
}

function renderRgba(size) {
  const buf = Buffer.alloc(size * size * 4);
  const ss = 3;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < ss; sy += 1) {
        for (let sx = 0; sx < ss; sx += 1) {
          const px = x + (sx + 0.5) / ss;
          const py = y + (sy + 0.5) / ss;
          const c = sample(size, px, py);
          if (c) {
            r += c[0];
            g += c[1];
            b += c[2];
            a += 255;
          }
        }
      }
      const n = ss * ss;
      const idx = (y * size + x) * 4;
      if (a > 0) {
        buf[idx] = Math.round(r / (a / 255));
        buf[idx + 1] = Math.round(g / (a / 255));
        buf[idx + 2] = Math.round(b / (a / 255));
        buf[idx + 3] = Math.round(a / n);
      }
    }
  }
  return buf;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])) >>> 0, 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function encodeIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const entries = [];
  let offset = 6 + images.length * 16;
  const blobs = [];
  for (const { size, png } of images) {
    const entry = Buffer.alloc(16);
    entry[0] = size >= 256 ? 0 : size;
    entry[1] = size >= 256 ? 0 : size;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    entries.push(entry);
    blobs.push(png);
  }
  return Buffer.concat([header, ...entries, ...blobs]);
}

mkdirSync(outDir, { recursive: true });

const sizes = [32, 128, 256];
const rendered = new Map();
for (const size of sizes) {
  rendered.set(size, encodePng(size, renderRgba(size)));
}

writeFileSync(join(outDir, "32x32.png"), rendered.get(32));
writeFileSync(join(outDir, "128x128.png"), rendered.get(128));
writeFileSync(join(outDir, "128x128@2x.png"), rendered.get(256));

const icoSizes = [16, 32, 48, 64, 128, 256];
const icoImages = icoSizes.map((size) => ({ size, png: encodePng(size, renderRgba(size)) }));
writeFileSync(join(outDir, "icon.ico"), encodeIco(icoImages));

console.log(`Wrote ${sizes.length + 1} icon files to ${outDir}`);
