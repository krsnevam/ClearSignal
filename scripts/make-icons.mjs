// Renders the ClearSignal app icons as PNGs with no image dependencies.
// Motif: a ranked list — three bars in High / Medium / Low colours on ink.
// Usage: node scripts/make-icons.mjs <outDir>
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

const INK = [0x0b, 0x0f, 0x14];
const BARS = [
  [0x0e, 0xa6, 0x57],
  [0xf0, 0xa0, 0x20],
  [0xb0, 0x20, 0x20],
];

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function render(size, safeZone) {
  const px = Buffer.alloc(size * size * 3);
  const set = (x, y, [r, g, b]) => {
    const i = (y * size + x) * 3;
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) set(x, y, INK);
  // Bars inside the safe zone (maskable icons crop to a circle of 80%).
  const inset = Math.round((size * (1 - safeZone)) / 2);
  const inner = size - 2 * inset;
  const barH = Math.round(inner * 0.16);
  const gap = Math.round(inner * 0.1);
  const lengths = [0.78, 0.58, 0.38];
  const top = inset + Math.round((inner - (3 * barH + 2 * gap)) / 2);
  const left = inset + Math.round(inner * 0.11);
  const radius = Math.round(barH / 2);
  BARS.forEach((color, i) => {
    const y0 = top + i * (barH + gap);
    const w = Math.round(inner * lengths[i]);
    for (let y = y0; y < y0 + barH; y++) {
      for (let x = left; x < left + w; x++) {
        // rounded ends
        const dx =
          x < left + radius
            ? left + radius - x
            : x >= left + w - radius
              ? x - (left + w - radius - 1)
              : 0;
        const dy = Math.abs(y - (y0 + radius - 0.5));
        if (dx > 0 && dx * dx + dy * dy > radius * radius) continue;
        set(x, y, color);
      }
    }
  });
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0; // filter: none
    px.copy(raw, y * (size * 3 + 1) + 1, y * size * 3, (y + 1) * size * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const out = process.argv[2] ?? 'apps/web/public/icons';
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'icon-192.png'), render(192, 0.9));
writeFileSync(join(out, 'icon-512.png'), render(512, 0.9));
writeFileSync(join(out, 'icon-maskable-512.png'), render(512, 0.72));
console.log(`icons written to ${out}`);
