/* Genereaza icons/icon-192.png si icons/icon-512.png fara dependente: PNG RGBA + zlib. */
const fs = require("fs"), path = require("path"), zlib = require("zlib");

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
/* Icon: fond teal plin (maskable-safe), o seringa stilizata alba pe diagonala. */
function draw(size) {
  const bg = [15, 110, 140], fg = [255, 255, 255];
  const s = size;
  // seringa in coordonate normalizate, rotita 45 grade
  const inside = (x, y) => {
    const cx = s / 2, cy = s / 2;
    const dx = x - cx, dy = y - cy;
    const u = (dx + dy) / Math.SQRT2 / s, v = (dy - dx) / Math.SQRT2 / s; // u de-a lungul, v perpendicular
    if (Math.abs(v) < 0.075 && u > -0.22 && u < 0.14) return true;          // corp
    if (Math.abs(v) < 0.018 && u >= 0.14 && u < 0.30) return true;          // ac
    if (Math.abs(v) < 0.11 && u > -0.245 && u < -0.215) return true;        // flansa
    if (Math.abs(v) < 0.03 && u > -0.34 && u < -0.245) return true;         // piston
    if (Math.abs(v) < 0.075 && u > -0.37 && u < -0.34) return true;         // capat piston
    // gradatii
    for (let i = 0; i < 5; i++) { const g = -0.18 + i * 0.07; if (Math.abs(u - g) < 0.008 && v > 0.02 && v < 0.06) return true; }
    return false;
  };
  return png(s, (x, y) => {
    // supersampling 2x2 pentru margini
    let n = 0;
    for (const ox of [0.25, 0.75]) for (const oy of [0.25, 0.75]) if (inside(x + ox, y + oy)) n++;
    const t = n / 4;
    return [Math.round(bg[0] + (fg[0] - bg[0]) * t), Math.round(bg[1] + (fg[1] - bg[1]) * t), Math.round(bg[2] + (fg[2] - bg[2]) * t), 255];
  });
}
const out = path.join(__dirname, "..", "icons");
fs.mkdirSync(out, { recursive: true });
for (const s of [192, 512]) fs.writeFileSync(path.join(out, `icon-${s}.png`), draw(s));
console.log("icons written to", out);
