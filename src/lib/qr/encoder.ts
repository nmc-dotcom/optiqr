/* ISO/IEC 18004 QR 인코더 — numeric / alphanumeric / byte 모드.
   품질 검사기가 cwMap(코드워드 배치)과 funcMap(기능 패턴 위치)을 직접 참조하므로
   qr-code-styling 등 외부 렌더러로 교체할 수 없다. 자세한 이유는 HANDOFF.md 3-1 참고. */
import type { Ecl, Mode, QRResult } from "./types";

export const ECC_CW_PER_BLOCK = [
  [-1,7,10,15,20,26,18,20,24,30,18,20,24,26,30,22,24,28,30,28,28,28,28,30,30,26,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
  [-1,10,16,26,18,24,16,18,22,22,26,30,22,22,24,24,28,28,26,26,26,26,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28],
  [-1,13,22,18,26,18,24,18,22,20,24,28,26,24,20,30,24,28,28,26,30,28,30,30,30,30,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
  [-1,17,28,22,16,22,28,26,26,24,28,24,28,22,24,24,30,28,28,26,28,30,24,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
];
export const NUM_ECC_BLOCKS = [
  [-1,1,1,1,1,1,2,2,2,2,4,4,4,4,4,6,6,6,6,7,8,8,9,9,10,12,12,12,13,14,15,16,17,18,19,19,20,21,22,24,25],
  [-1,1,1,1,2,2,4,4,4,5,5,5,8,9,9,10,10,11,13,14,16,17,17,18,20,21,23,25,26,28,29,31,33,35,37,38,40,43,45,47,49],
  [-1,1,1,2,2,4,4,6,6,8,8,8,10,12,16,12,17,16,18,21,20,23,23,25,27,29,34,34,35,38,40,43,45,48,51,53,56,59,62,65,68],
  [-1,1,1,2,4,4,4,5,6,8,8,11,11,16,16,18,16,19,21,25,25,25,34,30,32,35,37,40,42,45,48,51,54,57,60,63,66,70,74,77,81],
];
export const ECL_ORD: Record<Ecl, number> = { L: 0, M: 1, Q: 2, H: 3 };
export const ECL_FMT: Record<Ecl, number> = { L: 1, M: 0, Q: 3, H: 2 };
const ALNUM_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";

function gfMul(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}
function rsDivisor(degree: number): Uint8Array {
  const res = new Uint8Array(degree);
  res[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      res[j] = gfMul(res[j], root);
      if (j + 1 < degree) res[j] ^= res[j + 1];
    }
    root = gfMul(root, 2);
  }
  return res;
}
function rsRemainder(data: Uint8Array, divisor: Uint8Array): Uint8Array {
  const res = new Uint8Array(divisor.length);
  for (const b of data) {
    const factor = b ^ res[0];
    res.copyWithin(0, 1);
    res[res.length - 1] = 0;
    for (let i = 0; i < res.length; i++) res[i] ^= gfMul(divisor[i], factor);
  }
  return res;
}
export function rawDataModules(ver: number): number {
  let r = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const na = Math.floor(ver / 7) + 2;
    r -= (25 * na - 10) * na - 55;
    if (ver >= 7) r -= 36;
  }
  return r;
}
export function numDataCodewords(ver: number, ord: number): number {
  return (
    Math.floor(rawDataModules(ver) / 8) -
    ECC_CW_PER_BLOCK[ord][ver] * NUM_ECC_BLOCKS[ord][ver]
  );
}
function alignPositions(ver: number): number[] {
  if (ver === 1) return [];
  const n = Math.floor(ver / 7) + 2;
  const step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
  const out = [6];
  for (let pos = ver * 4 + 17 - 7; out.length < n; pos -= step) out.splice(1, 0, pos);
  return out;
}
function toUtf8(str: string): number[] {
  const out: number[] = [];
  for (const ch of str) {
    const cp = ch.codePointAt(0)!;
    if (cp < 0x80) out.push(cp);
    else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 63));
    else if (cp < 0x10000)
      out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    else
      out.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 63),
        0x80 | ((cp >> 6) & 63),
        0x80 | (cp & 63)
      );
  }
  return out;
}
export function pickMode(s: string): Mode {
  if (/^[0-9]+$/.test(s)) return "numeric";
  for (const ch of s) if (ALNUM_CHARS.indexOf(ch) < 0) return "byte";
  return "alnum";
}
export function ccBits(mode: Mode, ver: number): number {
  const t = ver <= 9 ? 0 : ver <= 26 ? 1 : 2;
  if (mode === "numeric") return [10, 12, 14][t];
  if (mode === "alnum") return [9, 11, 13][t];
  return [8, 16, 16][t];
}
class BitBuf {
  bits: number[] = [];
  push(val: number, len: number) {
    for (let i = len - 1; i >= 0; i--) this.bits.push((val >>> i) & 1);
  }
}
export function encodePayloadBits(mode: Mode, text: string) {
  const b = new BitBuf();
  if (mode === "numeric") {
    for (let i = 0; i < text.length; i += 3) {
      const chunk = text.substring(i, i + 3);
      b.push(parseInt(chunk, 10), chunk.length * 3 + 1);
    }
    return { buf: b, count: text.length };
  }
  if (mode === "alnum") {
    let i = 0;
    for (; i + 1 < text.length; i += 2) {
      b.push(ALNUM_CHARS.indexOf(text[i]) * 45 + ALNUM_CHARS.indexOf(text[i + 1]), 11);
    }
    if (i < text.length) b.push(ALNUM_CHARS.indexOf(text[i]), 6);
    return { buf: b, count: text.length };
  }
  const bytes = toUtf8(text);
  for (const x of bytes) b.push(x, 8);
  return { buf: b, count: bytes.length };
}

export function encodeQR(text: string, eclKey: Ecl): QRResult {
  const ord = ECL_ORD[eclKey];
  const mode = pickMode(text);
  const { buf: payload, count } = encodePayloadBits(mode, text);
  const modeInd = mode === "numeric" ? 1 : mode === "alnum" ? 2 : 4;

  let ver = -1, capBits = 0, usedBits = 0;
  for (let v = 1; v <= 40; v++) {
    const cap = numDataCodewords(v, ord) * 8;
    const need = 4 + ccBits(mode, v) + payload.bits.length;
    if (need <= cap) { ver = v; capBits = cap; usedBits = need; break; }
  }
  if (ver < 0) throw new Error("데이터가 QR 최대 용량(버전 40)을 초과했습니다.");

  const bb = new BitBuf();
  bb.push(modeInd, 4);
  bb.push(count, ccBits(mode, ver));
  bb.bits.push(...payload.bits);
  for (let i = 0; i < Math.min(4, capBits - bb.bits.length); i++) bb.bits.push(0);
  while (bb.bits.length % 8 !== 0) bb.bits.push(0);
  for (let pad = 0xec; bb.bits.length < capBits; pad ^= 0xec ^ 0x11) bb.push(pad, 8);

  const dataCw = new Uint8Array(bb.bits.length / 8);
  bb.bits.forEach((bit, i) => { dataCw[i >>> 3] |= bit << (7 - (i & 7)); });

  const all = interleave(dataCw, ver, ord);
  const size = ver * 4 + 17;
  const modules: boolean[][] = Array.from({ length: size }, () =>
    new Array(size).fill(false)
  );
  const isFunc: boolean[][] = Array.from({ length: size }, () =>
    new Array(size).fill(false)
  );

  const setF = (x: number, y: number, v: boolean) => {
    modules[y][x] = v;
    isFunc[y][x] = true;
  };

  // finders + separators
  const finder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        const x = cx + dx, y = cy + dy;
        if (x >= 0 && x < size && y >= 0 && y < size) setF(x, y, d !== 2 && d !== 4);
      }
  };
  // timing
  for (let i = 0; i < size; i++) { setF(6, i, i % 2 === 0); setF(i, 6, i % 2 === 0); }
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
  // alignment
  const ap = alignPositions(ver);
  for (let i = 0; i < ap.length; i++)
    for (let j = 0; j < ap.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === ap.length - 1) || (i === ap.length - 1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++)
          setF(ap[j] + dx, ap[i] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  // version info
  if (ver >= 7) {
    let rem = ver;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const vbits = (ver << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const bit = ((vbits >>> i) & 1) === 1;
      const a = size - 11 + (i % 3), b = Math.floor(i / 3);
      setF(a, b, bit); setF(b, a, bit);
    }
  }
  const drawFormat = (mask: number) => {
    const data = (ECL_FMT[eclKey] << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;
    const g = (i: number) => ((bits >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) setF(8, i, g(i));
    setF(8, 7, g(6)); setF(8, 8, g(7)); setF(7, 8, g(8));
    for (let i = 9; i < 15; i++) setF(14 - i, 8, g(i));
    for (let i = 0; i < 8; i++) setF(size - 1 - i, 8, g(i));
    for (let i = 8; i < 15; i++) setF(8, size - 15 + i, g(i));
    setF(8, size - 8, true);
  };
  drawFormat(0);

  // data placement
  // 각 모듈이 어느 코드워드에 속하는지 기록해 둔다. 로고 손상량을
  // 면적이 아니라 코드워드 단위로 정확히 계산하기 위한 지도다.
  const cwMap: number[][] = Array.from({ length: size }, () =>
    new Array(size).fill(-1)
  );
  let idx = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!isFunc[y][x] && idx < all.length * 8) {
          modules[y][x] = ((all[idx >>> 3] >>> (7 - (idx & 7))) & 1) === 1;
          cwMap[y][x] = idx >>> 3;
          idx++;
        }
      }
    }
  }

  const maskFn: ((x: number, y: number) => boolean)[] = [
    (x, y) => (x + y) % 2 === 0,
    (x, y) => y % 2 === 0,
    (x) => x % 3 === 0,
    (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
    (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
    (x, y) => ((((x + y) % 2) + ((x * y) % 3)) % 2) === 0,
  ];
  const applyMask = (m: number) => {
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++)
        if (!isFunc[y][x] && maskFn[m](x, y)) modules[y][x] = !modules[y][x];
  };

  let best = 0, bestPenalty = Infinity;
  for (let m = 0; m < 8; m++) {
    applyMask(m); drawFormat(m);
    const p = penalty(modules, size);
    if (p < bestPenalty) { bestPenalty = p; best = m; }
    applyMask(m);
  }
  applyMask(best); drawFormat(best);

  return {
    size,
    modules,
    funcMap: isFunc,
    cwMap,
    numBlocks: NUM_ECC_BLOCKS[ord][ver],
    eccLen: ECC_CW_PER_BLOCK[ord][ver],
    totalCw: all.length,
    version: ver,
    ecl: eclKey,
    mode,
    usage: usedBits / capBits,
    capBits,
    usedBits,
  };
}

function interleave(data: Uint8Array, ver: number, ord: number): number[] {
  const numBlocks = NUM_ECC_BLOCKS[ord][ver];
  const eccLen = ECC_CW_PER_BLOCK[ord][ver];
  const rawCw = Math.floor(rawDataModules(ver) / 8);
  const numShort = numBlocks - (rawCw % numBlocks);
  const shortLen = Math.floor(rawCw / numBlocks);
  const div = rsDivisor(eccLen);
  const blocks: number[][] = [];
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const len = shortLen - eccLen + (i < numShort ? 0 : 1);
    const dat = Array.from(data.slice(k, k + len));
    k += len;
    const ecc = Array.from(rsRemainder(Uint8Array.from(dat), div));
    if (i < numShort) dat.push(0);
    blocks.push(dat.concat(ecc));
  }
  const out: number[] = [];
  for (let i = 0; i < blocks[0].length; i++)
    for (let j = 0; j < blocks.length; j++)
      if (i !== shortLen - eccLen || j >= numShort) out.push(blocks[j][i]);
  return out;
}

function penalty(m: boolean[][], size: number): number {
  let p = 0, dark = 0;
  const runScan = (get: (a: number, b: number) => boolean) => {
    for (let a = 0; a < size; a++) {
      let run = 1, prev = get(a, 0);
      const line = [prev ? 1 : 0];
      for (let b = 1; b < size; b++) {
        const cur = get(a, b);
        line.push(cur ? 1 : 0);
        if (cur === prev) { run++; } else { if (run >= 5) p += 3 + (run - 5); run = 1; prev = cur; }
      }
      if (run >= 5) p += 3 + (run - 5);
      const s = line.join("");
      p += 40 * ((s.match(/10111010000/g) || []).length + (s.match(/00001011101/g) || []).length);
    }
  };
  runScan((a, b) => m[a][b]);
  runScan((a, b) => m[b][a]);
  for (let y = 0; y < size - 1; y++)
    for (let x = 0; x < size - 1; x++) {
      const v = m[y][x];
      if (v === m[y][x + 1] && v === m[y + 1][x] && v === m[y + 1][x + 1]) p += 3;
    }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (m[y][x]) dark++;
  const ratio = (dark * 100) / (size * size);
  p += Math.floor(Math.abs(ratio - 50) / 5) * 10;
  return p;
}
