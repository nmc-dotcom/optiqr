import { useMemo, useState } from "react";
import type { CSSProperties, ChangeEvent, ReactNode } from "react";

/* =========================================================================
   OptiQR — Phase 1
   홀로라도(holorado.me) 신규 도구 프로토타입
   100% 클라이언트 사이드. 서버/외부 API 없음.

   [인코더를 직접 구현한 이유]
   품질 검사기가 인코더 내부의 코드워드 배치(cwMap)와 기능 패턴 위치(funcMap)를
   직접 참조한다. qr-code-styling은 이 정보를 밖으로 노출하지 않으므로 교체할 수 없다.
   인코더가 틀리면 도구 전체가 무의미해지는데 눈으로는 검증이 안 되니,
   lib/qr/encoder.ts로 분리한 뒤 테스트를 붙일 것.
   ========================================================================= */

/* ------------------------------- 브랜드 토큰 ------------------------------ */
const C = {
  cream: "#F5F1E6",
  paper: "#FFFDF7",
  ink: "#22201C",
  inkSoft: "#6B655A",
  line: "#E0D8C4",
  green: "#1F4D3D",
  greenSoft: "#2F6B55",
  greenPale: "#E6EFEA",
  terra: "#C05F3C",
  terraPale: "#F7E7DF",
  amber: "#B98B2E",
  red: "#B23A2F",
};

const FONT =
  "'Pretendard','Pretendard Variable',-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic',system-ui,sans-serif";
const MONO = "'JetBrains Mono','SFMono-Regular',Menlo,Consolas,monospace";

/* ------------------------------- 타입 정의 ------------------------------- */
export type Ecl = "L" | "M" | "Q" | "H";
export type Mode = "numeric" | "alnum" | "byte";
export type Level = "error" | "warn" | "info" | "ok";
export type DotStyle = "square" | "rounded" | "extra" | "dots" | "classy" | "fluid";
export type EyeStyle = "square" | "rounded" | "circle" | "leaf";
export type DataType =
  | "url" | "text" | "email" | "tel" | "sms" | "wifi" | "vcard" | "geo";

export interface Design {
  fgMode: "solid" | "gradient";
  fg: string;
  fg2: string;
  gradType: "linear" | "radial";
  gradAngle: number;
  bg: string;
  bgTransparent: boolean;
  dotStyle: DotStyle;
  eyeStyle: EyeStyle;
  eyeOuterAuto: boolean;
  eyeOuterColor: string;
  eyeInnerAuto: boolean;
  eyeInnerColor: string;
  quietZone: number;
  size: number;
  ecc: Ecl;
}

export interface Logo {
  src: string | null;
  name: string;
  sizePct: number;
  pad: number;
  padShape: "circle" | "square";
  padColor: string;
}

export interface QRResult {
  size: number;
  modules: boolean[][];
  /** 기능 패턴(위치·정렬·타이밍) 여부. ECC 보호 대상이 아니다. */
  funcMap: boolean[][];
  /** 모듈이 속한 코드워드 번호. 로고 손상량 계산에 쓴다. -1은 데이터 아님. */
  cwMap: number[][];
  numBlocks: number;
  eccLen: number;
  totalCw: number;
  version: number;
  ecl: Ecl;
  mode: Mode;
  usage: number;
  capBits: number;
  usedBits: number;
}

export type QrState =
  | ({ ok: true } & QRResult)
  | { ok: false; empty?: boolean; error?: string };

export interface Issue {
  level: Level;
  title: string;
  detail: string;
  fix: string;
}

export interface Report {
  items: Issue[];
  score: number;
  grade: string;
  fatal: boolean;
}

export interface Fields {
  url: string;
  text: string;
  emailTo: string;
  emailSubject: string;
  emailBody: string;
  tel: string;
  smsTo: string;
  smsBody: string;
  wifiSsid: string;
  wifiPass: string;
  wifiAuth: string;
  wifiHidden: boolean;
  vcFirst: string;
  vcLast: string;
  vcOrg: string;
  vcTitle: string;
  vcTel: string;
  vcTel2: string;
  vcEmail: string;
  vcUrl: string;
  vcAddr: string;
  vcNote: string;
  geoLat: string;
  geoLng: string;
}

type SpecEntry = [string, any?, any?];
type Spec = Record<string, SpecEntry>;


/* =========================================================================
   1. QR ENCODER  (ISO/IEC 18004 — numeric / alphanumeric / byte)
   ========================================================================= */

const ECC_CW_PER_BLOCK = [
  [-1,7,10,15,20,26,18,20,24,30,18,20,24,26,30,22,24,28,30,28,28,28,28,30,30,26,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
  [-1,10,16,26,18,24,16,18,22,22,26,30,22,22,24,24,28,28,26,26,26,26,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28],
  [-1,13,22,18,26,18,24,18,22,20,24,28,26,24,20,30,24,28,28,26,30,28,30,30,30,30,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
  [-1,17,28,22,16,22,28,26,26,24,28,24,28,22,24,24,30,28,28,26,28,30,24,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
];
const NUM_ECC_BLOCKS = [
  [-1,1,1,1,1,1,2,2,2,2,4,4,4,4,4,6,6,6,6,7,8,8,9,9,10,12,12,12,13,14,15,16,17,18,19,19,20,21,22,24,25],
  [-1,1,1,1,2,2,4,4,4,5,5,5,8,9,9,10,10,11,13,14,16,17,17,18,20,21,23,25,26,28,29,31,33,35,37,38,40,43,45,47,49],
  [-1,1,1,2,2,4,4,6,6,8,8,8,10,12,16,12,17,16,18,21,20,23,23,25,27,29,34,34,35,38,40,43,45,48,51,53,56,59,62,65,68],
  [-1,1,1,2,4,4,4,5,6,8,8,11,11,16,16,18,16,19,21,25,25,25,34,30,32,35,37,40,42,45,48,51,54,57,60,63,66,70,74,77,81],
];
const ECL_ORD: Record<Ecl, number> = { L: 0, M: 1, Q: 2, H: 3 };
const ECL_FMT: Record<Ecl, number> = { L: 1, M: 0, Q: 3, H: 2 };
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
function rawDataModules(ver: number): number {
  let r = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const na = Math.floor(ver / 7) + 2;
    r -= (25 * na - 10) * na - 55;
    if (ver >= 7) r -= 36;
  }
  return r;
}
function numDataCodewords(ver: number, ord: number): number {
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
function pickMode(s: string): Mode {
  if (/^[0-9]+$/.test(s)) return "numeric";
  for (const ch of s) if (ALNUM_CHARS.indexOf(ch) < 0) return "byte";
  return "alnum";
}
function ccBits(mode: Mode, ver: number): number {
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
function encodePayloadBits(mode: Mode, text: string) {
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

function encodeQR(text: string, eclKey: Ecl): QRResult {
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

/* =========================================================================
   2. SVG RENDERER
   ========================================================================= */

const f = (n: number) => Math.round(n * 1000) / 1000;

function roundPath(
  x: number,
  y: number,
  tl: number,
  tr: number,
  br: number,
  bl: number
): string {
  return [
    `M${f(x + tl)},${f(y)}`,
    `H${f(x + 1 - tr)}`, tr ? `A${f(tr)},${f(tr)} 0 0 1 ${f(x + 1)},${f(y + tr)}` : "",
    `V${f(y + 1 - br)}`, br ? `A${f(br)},${f(br)} 0 0 1 ${f(x + 1 - br)},${f(y + 1)}` : "",
    `H${f(x + bl)}`, bl ? `A${f(bl)},${f(bl)} 0 0 1 ${f(x)},${f(y + 1 - bl)}` : "",
    `V${f(y + tl)}`, tl ? `A${f(tl)},${f(tl)} 0 0 1 ${f(x + tl)},${f(y)}` : "",
    "Z",
  ].join("");
}

function ringPath(
  x: number,
  y: number,
  size: number,
  hole: number,
  r: number,
  rIn: number
): string {
  const o = roundPath0(x, y, size, r);
  const g = (size - hole) / 2;
  const i = roundPath0(x + g, y + g, hole, rIn);
  return o + i;
}
function roundPath0(x: number, y: number, s: number, r: number): string {
  r = Math.min(r, s / 2);
  if (r <= 0) return `M${f(x)},${f(y)}H${f(x + s)}V${f(y + s)}H${f(x)}Z`;
  return [
    `M${f(x + r)},${f(y)}`, `H${f(x + s - r)}`, `A${f(r)},${f(r)} 0 0 1 ${f(x + s)},${f(y + r)}`,
    `V${f(y + s - r)}`, `A${f(r)},${f(r)} 0 0 1 ${f(x + s - r)},${f(y + s)}`,
    `H${f(x + r)}`, `A${f(r)},${f(r)} 0 0 1 ${f(x)},${f(y + s - r)}`,
    `V${f(y + r)}`, `A${f(r)},${f(r)} 0 0 1 ${f(x + r)},${f(y)}`, "Z",
  ].join("");
}
function leafPath(x: number, y: number, s: number, r: number): string {
  return [
    `M${f(x)},${f(y + r)}`, `A${f(r)},${f(r)} 0 0 1 ${f(x + r)},${f(y)}`,
    `H${f(x + s)}`, `V${f(y + s - r)}`, `A${f(r)},${f(r)} 0 0 1 ${f(x + s - r)},${f(y + s)}`,
    `H${f(x)}`, "Z",
  ].join("");
}

function buildSvg(
  qr: QRResult,
  design: Design,
  logo: Logo,
  px: number | null
): string {
  const { size: N, modules: m } = qr;
  const qz = design.quietZone;
  const T = N + qz * 2;
  const isEye = (x: number, y: number) =>
    (x < 7 && y < 7) || (x >= N - 7 && y < 7) || (x < 7 && y >= N - 7);
  const on = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < N && y < N && m[y][x] && !isEye(x, y);

  /* --- dots --- */
  const parts: string[] = [];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (!m[y][x] || isEye(x, y)) continue;
      const px0 = x + qz, py0 = y + qz;
      switch (design.dotStyle) {
        case "dots":
          parts.push(`<circle cx="${f(px0 + 0.5)}" cy="${f(py0 + 0.5)}" r="0.44"/>`);
          break;
        case "rounded":
          parts.push(`<path d="${roundPath(px0, py0, 0.3, 0.3, 0.3, 0.3)}"/>`);
          break;
        case "extra":
          parts.push(`<path d="${roundPath(px0, py0, 0.5, 0.5, 0.5, 0.5)}"/>`);
          break;
        case "classy":
          parts.push(`<path d="${roundPath(px0, py0, 0.5, 0, 0.5, 0)}"/>`);
          break;
        case "fluid": {
          const up = on(x, y - 1), dn = on(x, y + 1), lf = on(x - 1, y), rt = on(x + 1, y);
          const R = 0.5;
          parts.push(
            `<path d="${roundPath(
              px0, py0,
              !up && !lf ? R : 0, !up && !rt ? R : 0,
              !dn && !rt ? R : 0, !dn && !lf ? R : 0
            )}"/>`
          );
          break;
        }
        default:
          parts.push(`<rect x="${f(px0)}" y="${f(py0)}" width="1" height="1"/>`);
      }
    }
  }

  /* --- eyes --- */
  const eyeOuter = design.eyeOuterAuto ? null : design.eyeOuterColor;
  const eyeInner = design.eyeInnerAuto ? null : design.eyeInnerColor;
  const eyeCoords = [[0, 0], [N - 7, 0], [0, N - 7]];
  const outerPaths: string[] = [];
  const innerPaths: string[] = [];
  for (const [ex, ey] of eyeCoords) {
    const x = ex + qz, y = ey + qz;
    if (design.eyeStyle === "circle") {
      outerPaths.push(
        `<path fill-rule="evenodd" d="M${f(x + 3.5)},${f(y)}a3.5,3.5 0 1 1 -0.01,0Z M${f(x + 3.5)},${f(y + 1)}a2.5,2.5 0 1 0 0.01,0Z"/>`
      );
      innerPaths.push(`<circle cx="${f(x + 3.5)}" cy="${f(y + 3.5)}" r="1.5"/>`);
    } else if (design.eyeStyle === "rounded") {
      outerPaths.push(`<path fill-rule="evenodd" d="${ringPath(x, y, 7, 5, 1.9, 1.2)}"/>`);
      innerPaths.push(`<path d="${roundPath0(x + 2, y + 2, 3, 0.9)}"/>`);
    } else if (design.eyeStyle === "leaf") {
      outerPaths.push(
        `<path fill-rule="evenodd" d="${leafPath(x, y, 7, 2.6)}${leafPath(x + 1, y + 1, 5, 1.9)}"/>`
      );
      innerPaths.push(`<path d="${leafPath(x + 2, y + 2, 3, 1.1)}"/>`);
    } else {
      outerPaths.push(`<path fill-rule="evenodd" d="${ringPath(x, y, 7, 5, 0, 0)}"/>`);
      innerPaths.push(`<rect x="${f(x + 2)}" y="${f(y + 2)}" width="3" height="3"/>`);
    }
  }

  /* --- paint --- */
  const useGrad = design.fgMode === "gradient";
  const fgPaint = useGrad ? "url(#qsFg)" : design.fg;
  let defs = "";
  if (useGrad) {
    if (design.gradType === "radial") {
      defs = `<radialGradient id="qsFg" cx="0.5" cy="0.5" r="0.72"><stop offset="0" stop-color="${design.fg}"/><stop offset="1" stop-color="${design.fg2}"/></radialGradient>`;
    } else {
      const a = (design.gradAngle * Math.PI) / 180;
      const x1 = 0.5 - Math.cos(a) / 2, y1 = 0.5 - Math.sin(a) / 2;
      const x2 = 0.5 + Math.cos(a) / 2, y2 = 0.5 + Math.sin(a) / 2;
      defs = `<linearGradient id="qsFg" x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}"><stop offset="0" stop-color="${design.fg}"/><stop offset="1" stop-color="${design.fg2}"/></linearGradient>`;
    }
  }

  /* --- logo --- */
  let logoSvg = "";
  if (logo.src) {
    const w = logo.sizePct * N;
    const cx = T / 2, cy = T / 2;
    const padW = w + logo.pad * N * 2;
    if (logo.pad > 0) {
      logoSvg +=
        logo.padShape === "circle"
          ? `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(padW / 2)}" fill="${logo.padColor}"/>`
          : `<path d="${roundPath0(cx - padW / 2, cy - padW / 2, padW, padW * 0.16)}" fill="${logo.padColor}"/>`;
    }
    logoSvg += `<image x="${f(cx - w / 2)}" y="${f(cy - w / 2)}" width="${f(w)}" height="${f(w)}" preserveAspectRatio="xMidYMid meet" href="${logo.src}"/>`;
  }

  const dim = px ? ` width="${px}" height="${px}"` : "";
  const bgRect = design.bgTransparent
    ? ""
    : `<rect width="${T}" height="${T}" fill="${design.bg}"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"${dim} viewBox="0 0 ${T} ${T}" shape-rendering="geometricPrecision">${
    defs ? `<defs>${defs}</defs>` : ""
  }${bgRect}<g fill="${fgPaint}">${parts.join("")}</g><g fill="${
    eyeOuter || fgPaint
  }">${outerPaths.join("")}</g><g fill="${eyeInner || fgPaint}">${innerPaths.join(
    ""
  )}</g>${logoSvg}</svg>`;
}

/* =========================================================================
   3. 품질 검사 엔진
   ========================================================================= */

function hexRgb(h: string): number[] {
  const s = h.replace("#", "");
  const v = s.length === 3 ? s.split("").map((c) => c + c).join("") : s;
  const n = parseInt(v, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function lum(hex: string): number {
  const [r, g, b] = hexRgb(hex).map((c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const l1 = lum(a), l2 = lum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

const ECC_INFO: Record<Ecl, { pct: string; use: string; desc: string }> = {
  L: {
    pct: "7%",
    use: "화면 전용",
    desc: "훼손 복원 여력이 거의 없습니다. 같은 데이터를 가장 작은 QR로 담을 수 있어 화면에만 띄울 때 유리하지만, 인쇄물이나 로고 삽입에는 쓰지 마세요.",
  },
  M: {
    pct: "15%",
    use: "일반 기본값",
    desc: "대부분의 QR이 쓰는 기본값입니다. 화면과 깨끗한 실내 인쇄물에 적당하고, 로고를 넣기에는 여유가 부족합니다.",
  },
  Q: {
    pct: "25%",
    use: "인쇄물·작은 로고",
    desc: "명함·전단처럼 접히거나 긁힐 수 있는 인쇄물에 적합합니다. 작은 로고 정도는 감당합니다.",
  },
  H: {
    pct: "30%",
    use: "로고 삽입·야외",
    desc: "코드의 30%가 가려지거나 더러워져도 복원됩니다. 로고를 넣거나 스티커·현수막처럼 훼손 가능성이 있는 곳에 붙일 때 선택하세요.",
  },
};

/* 전체 인코딩 없이 필요한 버전만 계산한다 (ECC 비교 표시용) */
function versionFor(text: string, eclKey: Ecl): number | null {
  if (!text) return null;
  const ord = ECL_ORD[eclKey];
  const mode = pickMode(text);
  const { buf } = encodePayloadBits(mode, text);
  for (let v = 1; v <= 40; v++) {
    if (4 + ccBits(mode, v) + buf.bits.length <= numDataCodewords(v, ord) * 8) return v;
  }
  return null;
}

/* 로고가 덮는 영역을 코드워드 단위로 계산한다.
   ECC의 "30% 복원"은 면적이 아니라 코드워드 개수 기준이고,
   원형 로고의 경계는 수많은 코드워드를 조금씩만 걸치면서 통째로 손상시킨다.
   그래서 면적 비율로 판정하면 실제 손상을 크게 과소평가한다. */
function logoDamage(qr: QRResult, logo: Logo, sizePct?: number) {
  const N = qr.size;
  const pct = sizePct == null ? logo.sizePct : sizePct;
  const half = (pct * N) / 2 + logo.pad * N;
  const c = N / 2;
  const round = logo.pad > 0 && logo.padShape === "circle";
  const touched = new Set<number>();
  let funcHit = 0, covered = 0;

  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const dx = x + 0.5 - c, dy = y + 0.5 - c;
      const inside = round
        ? dx * dx + dy * dy <= half * half
        : Math.abs(dx) <= half && Math.abs(dy) <= half;
      if (!inside) continue;
      covered++;
      if (qr.funcMap[y][x]) funcHit++;
      else if (qr.cwMap[y][x] >= 0) touched.add(qr.cwMap[y][x]);
    }
  }

  // 인터리빙은 코드워드를 블록에 라운드로빈으로 흩뿌린다.
  const perBlock: number[] = new Array(qr.numBlocks).fill(0);
  touched.forEach((i: number) => {
    perBlock[i % qr.numBlocks]++;
  });

  // 스캐너는 손상 위치를 모르므로 오류 정정으로 처리한다 → 블록당 ECC/2개까지.
  const cap = Math.max(1, Math.floor(qr.eccLen / 2));
  const worst = Math.max(...perBlock);
  return {
    funcHit,
    covered,
    damaged: touched.size,
    cap,
    worst,
    load: worst / cap,
    areaPct: covered / (N * N),
  };
}

/* 안전 범위(정정 한계의 60% 이하)에 들어가는 최대 로고 크기 */
function safeLogoSize(qr: QRResult, logo: Logo): number | null {
  let lo = 0.05,
    hi = logo.sizePct;
  let best: number | null = null;
  for (let i = 0; i < 9; i++) {
    const mid = (lo + hi) / 2;
    const dmg = logoDamage(qr, logo, mid);
    if (dmg.funcHit === 0 && dmg.load <= 0.6) { best = mid; lo = mid; } else hi = mid;
  }
  return best;
}

function inspect(qr: QRResult, design: Design, logo: Logo): Report {
  const out: Issue[] = [];
  const add = (level: Level, title: string, detail: string, fix: string) =>
    out.push({ level, title, detail, fix });
  const bgRef = design.bgTransparent ? "#FFFFFF" : design.bg;
  const fgs = design.fgMode === "gradient" ? [design.fg, design.fg2] : [design.fg];
  const cr = Math.min(...fgs.map((c) => contrast(c, bgRef)));

  if (cr < 2.5)
    add("error", "명암비 부족", `모듈과 배경의 명암비가 ${cr.toFixed(1)}:1 입니다. 대부분의 스캐너가 인식에 실패합니다.`, "전경을 더 어둡게 하거나 배경을 더 밝게 조정하세요. 7:1 이상을 권장합니다.");
  else if (cr < 4.5)
    add("warn", "명암비 낮음", `명암비 ${cr.toFixed(1)}:1. 조명이 어둡거나 저가 카메라에서 실패할 수 있습니다.`, "7:1 이상으로 올리면 안정적입니다.");
  else if (cr < 7)
    add("info", "명암비 보통", `명암비 ${cr.toFixed(1)}:1. 일반적인 환경에서는 인식되지만 인쇄물에서는 여유가 부족합니다.`, "인쇄용이면 7:1 이상을 권장합니다.");
  else
    add("ok", "명암비 충분", `명암비 ${cr.toFixed(1)}:1로 여유가 있습니다.`, "");

  if (lum(fgs[0]) > lum(bgRef))
    add("warn", "명암 반전", "배경이 모듈보다 어둡습니다. 반전 QR을 읽지 못하는 스캐너가 아직 남아 있습니다.", "밝은 배경 + 어두운 모듈 조합으로 되돌리는 편이 안전합니다.");

  if (!design.eyeOuterAuto || !design.eyeInnerAuto) {
    const eyeCols = [];
    if (!design.eyeOuterAuto) eyeCols.push(["Eye 프레임", design.eyeOuterColor]);
    if (!design.eyeInnerAuto) eyeCols.push(["Eye 중심", design.eyeInnerColor]);
    for (const [name, col] of eyeCols) {
      const ec = contrast(col, bgRef);
      if (ec < 3)
        add("error", `${name} 색상이 배경과 유사`, `명암비 ${ec.toFixed(1)}:1. Eye는 스캐너가 QR의 위치와 방향을 잡는 기준이라 실패하면 인식 자체가 안 됩니다.`, "Eye는 배경과 가장 대비가 큰 색으로 두세요.");
      else if (ec < 4.5)
        add("warn", `${name} 색상 대비 약함`, `명암비 ${ec.toFixed(1)}:1. 위치 검출이 불안정할 수 있습니다.`, "Eye 색상은 본문 모듈보다 더 강한 대비를 권장합니다.");
    }
  }

  if (design.quietZone === 0)
    add("error", "Quiet Zone 없음", "여백이 0입니다. 규격은 4모듈 이상을 요구하며, 배경 위에 얹으면 대부분 인식에 실패합니다.", "여백을 4모듈 이상으로 설정하세요.");
  else if (design.quietZone < 4)
    add("warn", "Quiet Zone 부족", `현재 ${design.quietZone}모듈. 규격 최소값은 4모듈입니다.`, "4모듈 이상으로 올리세요.");
  else add("ok", "Quiet Zone 확보", `${design.quietZone}모듈로 규격을 충족합니다.`, "");

  if (logo.src) {
    const dmg = logoDamage(qr, logo);

    if (dmg.funcHit > 0)
      add(
        "error",
        "기능 패턴 침범",
        `로고가 위치·정렬·타이밍 패턴 ${dmg.funcHit}칸을 덮고 있습니다. 이 패턴은 오류 정정 대상이 아니라 ECC를 H로 올려도 복원되지 않습니다.`,
        "로고를 줄이세요. 기능 패턴이 하나라도 가려지면 스캔이 불가능합니다."
      );

    if (dmg.load >= 1)
      add(
        "error",
        "복원 한계 초과",
        `로고가 코드워드 ${dmg.damaged}개를 손상시킵니다. 블록당 최대 손상이 ${dmg.worst}개인데 정정 한도는 ${dmg.cap}개입니다(한도의 ${(dmg.load * 100).toFixed(0)}%). 면적은 ${(dmg.areaPct * 100).toFixed(1)}%로 작아 보여도 경계가 코드워드를 잘게 걸쳐 손상량이 훨씬 큽니다.`,
        (() => {
          const s = safeLogoSize(qr, logo);
          return s
            ? `로고 크기를 ${(s * 100).toFixed(0)}% 이하로 줄이거나, 보호 여백을 줄이세요.`
            : "로고 크기와 보호 여백을 모두 크게 줄이세요.";
        })()
      );
    else if (dmg.load >= 0.7)
      add(
        "warn",
        "복원 여유 부족",
        `코드워드 ${dmg.damaged}개 손상, 블록당 정정 한도의 ${(dmg.load * 100).toFixed(0)}%를 소모합니다.`,
        "인쇄 번짐이나 오염이 조금만 더해져도 실패합니다. 60% 이하를 권장합니다."
      );
    else
      add(
        "ok",
        "로고 크기 안전",
        `코드워드 ${dmg.damaged}개 손상, 정정 한도의 ${(dmg.load * 100).toFixed(0)}%만 사용합니다.`,
        ""
      );

    if (design.ecc !== "H")
      add("warn", "ECC 상향 권장", `로고를 넣었는데 ECC가 ${design.ecc}입니다.`, "로고 삽입 시에는 ECC H(30%)가 사실상 표준입니다.");

    if (qr.version <= 4)
      add(
        "info",
        "QR이 작아 로고에 취약",
        `버전 ${qr.version}은 코드워드가 ${qr.totalCw}개뿐이라 같은 크기의 로고라도 손상 비중이 훨씬 큽니다.`,
        "로고를 쓸 계획이면 URL을 조금 길게 두거나 ECC를 올려 버전을 키우는 편이 오히려 안정적입니다."
      );
  }

  if (design.bgTransparent)
    add("warn", "투명 배경", "PNG 투명 배경은 어두운 표면 위에 올리면 명암이 반전되어 인식에 실패합니다.", "인쇄·배포용이면 불투명 배경을 쓰고, 웹 합성용으로만 투명을 사용하세요.");

  const modulePx = design.size / (qr.size + design.quietZone * 2);
  if (modulePx < 2)
    add("error", "모듈 해상도 부족", `모듈 1칸이 ${modulePx.toFixed(1)}px입니다. 렌더링 시 뭉개집니다.`, "내보내기 크기를 키우거나 데이터를 줄이세요.");
  else if (modulePx < 4)
    add("warn", "모듈 해상도 낮음", `모듈 1칸이 ${modulePx.toFixed(1)}px. 화면에선 되지만 인쇄 시 위험합니다.`, "인쇄용은 모듈당 4px 이상, 또는 SVG로 내보내세요.");

  if (qr.version >= 27)
    add("warn", "데이터 과다", `버전 ${qr.version} (${qr.size}×${qr.size} 모듈). 모듈이 촘촘해 스캔 거리가 크게 짧아집니다.`, "URL을 짧게 하거나 vCard 항목을 줄이세요.");
  else if (qr.version >= 15)
    add("info", "데이터 다소 많음", `버전 ${qr.version} (${qr.size}×${qr.size} 모듈).`, "가까이서 스캔해야 할 수 있습니다.");

  if (qr.usage > 0.96)
    add("info", "용량 거의 가득 참", `현재 버전 용량의 ${(qr.usage * 100).toFixed(0)}%를 사용 중입니다.`, "한 글자만 더해도 버전이 올라가 모듈이 촘촘해집니다.");

  const weights: Record<Level, number> = { error: 26, warn: 11, info: 3, ok: 0 };
  const raw = Math.max(0, 100 - out.reduce((s, i) => s + weights[i.level], 0));

  // 오류 항목은 그 하나만으로 스캔이 실패한다. 다른 항목이 아무리 정상이어도
  // 평균으로 상쇄되면 안 되므로 점수를 묶고 등급을 F로 고정한다.
  const fatal = out.some((i) => i.level === "error");
  const score = fatal ? Math.min(raw, 39) : raw;
  const grade = fatal ? "F" : score >= 90 ? "A" : score >= 75 ? "B" : score >= 55 ? "C" : "D";

  const rank: Record<Level, number> = { error: 0, warn: 1, info: 2, ok: 3 };
  out.sort((a, b) => rank[a.level] - rank[b.level]);
  return { items: out, score, grade, fatal };
}

/* =========================================================================
   4. PAYLOAD BUILDERS
   ========================================================================= */

const wifiEsc = (s: string) => (s || "").replace(/([\\;,:"])/g, "\\$1");
const vcEsc = (s: string) => (s || "").replace(/([\\;,])/g, "\\$1").replace(/\n/g, "\\n");

function buildPayload(type: DataType, d: Fields): string {
  switch (type) {
    case "url": {
      const u = (d.url || "").trim();
      if (!u) return "";
      return /^[a-zA-Z][a-zA-Z0-9+.\-]*:/.test(u) ? u : "https://" + u;
    }
    case "text":
      return d.text || "";
    case "email": {
      if (!d.emailTo) return "";
      const q = [];
      if (d.emailSubject) q.push("subject=" + encodeURIComponent(d.emailSubject));
      if (d.emailBody) q.push("body=" + encodeURIComponent(d.emailBody));
      return `mailto:${d.emailTo}${q.length ? "?" + q.join("&") : ""}`;
    }
    case "tel": {
      const n = (d.tel || "").replace(/[^\d+]/g, "");
      return n ? `tel:${n}` : "";
    }
    case "sms": {
      const n = (d.smsTo || "").replace(/[^\d+]/g, "");
      return n ? `SMSTO:${n}:${d.smsBody || ""}` : "";
    }
    case "wifi": {
      if (!d.wifiSsid) return "";
      const t = d.wifiAuth === "nopass" ? "nopass" : d.wifiAuth;
      return `WIFI:T:${t};S:${wifiEsc(d.wifiSsid)};${
        t === "nopass" ? "" : `P:${wifiEsc(d.wifiPass)};`
      }${d.wifiHidden ? "H:true;" : ""};`;
    }
    case "vcard": {
      if (!d.vcFirst && !d.vcLast && !d.vcOrg) return "";
      const L: string[] = ["BEGIN:VCARD", "VERSION:3.0"];
      L.push(`N:${vcEsc(d.vcLast)};${vcEsc(d.vcFirst)};;;`);
      L.push(`FN:${vcEsc([d.vcFirst, d.vcLast].filter(Boolean).join(" "))}`);
      if (d.vcOrg) L.push(`ORG:${vcEsc(d.vcOrg)}`);
      if (d.vcTitle) L.push(`TITLE:${vcEsc(d.vcTitle)}`);
      if (d.vcTel) L.push(`TEL;TYPE=CELL:${d.vcTel}`);
      if (d.vcTel2) L.push(`TEL;TYPE=WORK:${d.vcTel2}`);
      if (d.vcEmail) L.push(`EMAIL;TYPE=INTERNET:${d.vcEmail}`);
      if (d.vcUrl) L.push(`URL:${d.vcUrl}`);
      if (d.vcAddr) L.push(`ADR;TYPE=WORK:;;${vcEsc(d.vcAddr)};;;;`);
      if (d.vcNote) L.push(`NOTE:${vcEsc(d.vcNote)}`);
      L.push("END:VCARD");
      return L.join("\n");
    }
    case "geo": {
      if (!d.geoLat || !d.geoLng) return "";
      return `geo:${d.geoLat},${d.geoLng}`;
    }
    default:
      return "";
  }
}

/* =========================================================================
   5. UI PRIMITIVES
   ========================================================================= */

function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      className="rounded-lg p-5"
      style={{ background: C.paper, border: `1px solid ${C.line}`, ...style }}
    >
      {children}
    </div>
  );
}

function Label({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-2">
      <span className="text-xs font-semibold tracking-wide" style={{ color: C.inkSoft }}>
        {children}
      </span>
      {hint && (
        <span className="text-xs" style={{ color: C.inkSoft, opacity: 0.7 }}>
          {hint}
        </span>
      )}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  multiline,
  rows = 3,
  mono,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  mono?: boolean;
}) {
  const base: CSSProperties = {
    background: C.cream,
    border: `1px solid ${C.line}`,
    color: C.ink,
    fontFamily: mono ? MONO : FONT,
  };
  const cls = "w-full rounded px-3 py-2 text-sm outline-none";
  return multiline ? (
    <textarea
      className={cls + " resize-y"}
      rows={rows}
      style={base}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  ) : (
    <input
      className={cls}
      style={base}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function Seg({
  options,
  value,
  onChange,
  columns,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: any) => void;
  columns?: number;
}) {
  return (
    <div
      className="grid gap-1 rounded p-1"
      style={{
        background: C.cream,
        border: `1px solid ${C.line}`,
        gridTemplateColumns: `repeat(${columns || options.length}, minmax(0,1fr))`,
      }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className="rounded px-2 py-1.5 text-xs font-medium transition-colors"
            style={{
              background: active ? C.green : "transparent",
              color: active ? C.paper : C.inkSoft,
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Slider({
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        className="h-1 flex-1"
        style={{ accentColor: C.green }}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      <span
        className="w-16 text-right text-xs tabular-nums"
        style={{ color: C.inkSoft, fontFamily: MONO }}
      >
        {format ? format(value) : value}
      </span>
    </div>
  );
}

function ColorField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2" style={{ opacity: disabled ? 0.4 : 1 }}>
      <input
        type="color"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-10 cursor-pointer rounded"
        style={{ border: `1px solid ${C.line}`, background: C.cream, padding: 2 }}
      />
      <input
        value={value.toUpperCase()}
        disabled={disabled}
        onChange={(e) => {
          const v = e.target.value.trim();
          if (/^#?[0-9a-fA-F]{6}$/.test(v)) onChange(v.startsWith("#") ? v : "#" + v);
        }}
        className="w-24 rounded px-2 py-1.5 text-xs uppercase outline-none"
        style={{
          background: C.cream,
          border: `1px solid ${C.line}`,
          color: C.ink,
          fontFamily: MONO,
        }}
      />
    </div>
  );
}

function Check({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 text-xs"
      style={{ color: C.inkSoft }}
    >
      <span
        className="flex h-4 w-4 items-center justify-center rounded"
        style={{
          border: `1px solid ${checked ? C.green : C.line}`,
          background: checked ? C.green : C.cream,
          color: C.paper,
          fontSize: 10,
        }}
      >
        {checked ? "✓" : ""}
      </span>
      {children}
    </button>
  );
}

/* =========================================================================
   6. MAIN
   ========================================================================= */

const TYPES = [
  { value: "url", label: "URL" },
  { value: "text", label: "텍스트" },
  { value: "email", label: "이메일" },
  { value: "tel", label: "전화" },
  { value: "sms", label: "SMS" },
  { value: "wifi", label: "WiFi" },
  { value: "vcard", label: "명함" },
  { value: "geo", label: "위치" },
];

const DEFAULT_DESIGN: Design = {
  fgMode: "solid",
  fg: C.green,
  fg2: C.terra,
  gradType: "linear",
  gradAngle: 45,
  bg: C.paper,
  bgTransparent: false,
  dotStyle: "fluid",
  eyeStyle: "rounded",
  eyeOuterAuto: true,
  eyeOuterColor: C.terra,
  eyeInnerAuto: true,
  eyeInnerColor: C.green,
  quietZone: 4,
  size: 1024,
  ecc: "H",
};
const DEFAULT_LOGO: Logo = {
  src: null,
  name: "",
  sizePct: 0.2,
  pad: 0.03,
  padShape: "circle",
  padColor: C.paper,
};

/* 프리셋 파일은 사용자가 편집할 수 있는 외부 입력이다.
   구조를 믿지 않고 알려진 키만, 알려진 범위로 좁혀서 받는다. */
const DESIGN_SPEC: Spec = {
  fgMode: ["enum", ["solid", "gradient"]],
  fg: ["hex"],
  fg2: ["hex"],
  gradType: ["enum", ["linear", "radial"]],
  gradAngle: ["num", 0, 360],
  bg: ["hex"],
  bgTransparent: ["bool"],
  dotStyle: ["enum", ["square", "rounded", "extra", "dots", "classy", "fluid"]],
  eyeStyle: ["enum", ["square", "rounded", "circle", "leaf"]],
  eyeOuterAuto: ["bool"],
  eyeOuterColor: ["hex"],
  eyeInnerAuto: ["bool"],
  eyeInnerColor: ["hex"],
  quietZone: ["int", 0, 10],
  size: ["int", 256, 2048],
  ecc: ["enum", ["L", "M", "Q", "H"]],
};
const LOGO_SPEC: Spec = {
  sizePct: ["num", 0.08, 0.4],
  pad: ["num", 0, 0.08],
  padShape: ["enum", ["circle", "square"]],
  padColor: ["hex"],
  name: ["str"],
  src: ["dataurl"],
};

function coerce<T>(raw: any, spec: Spec, defaults: T): T {
  const out: any = { ...defaults };
  if (!raw || typeof raw !== "object") return out;
  for (const k of Object.keys(spec)) {
    const [t, a, b] = spec[k];
    const v = raw[k];
    if (t === "hex" && typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v)) out[k] = v;
    else if (t === "bool" && typeof v === "boolean") out[k] = v;
    else if ((t === "num" || t === "int") && typeof v === "number" && isFinite(v)) {
      const c = Math.min(b, Math.max(a, v));
      out[k] = t === "int" ? Math.round(c) : c;
    } else if (t === "enum" && a.indexOf(v) >= 0) out[k] = v;
    else if (t === "str" && typeof v === "string") out[k] = v.slice(0, 120);
    else if (
      t === "dataurl" &&
      typeof v === "string" &&
      // data: URI만 허용한다. 원격 URL이 들어오면 정적·오프라인 원칙이 깨지고
      // 프리셋을 여는 것만으로 외부 요청이 나가게 된다.
      /^data:image\/(png|jpeg|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(v) &&
      v.length < 1_500_000
    )
      out[k] = v;
  }
  return out as T;
}

export default function QRStudio() {
  const [tab, setTab] = useState("data");
  const [type, setType] = useState<DataType>("url");
  const [showCriteria, setShowCriteria] = useState(false);

  const [d, setD] = useState<Fields>({
    url: "https://holorado.me",
    text: "",
    emailTo: "", emailSubject: "", emailBody: "",
    tel: "",
    smsTo: "", smsBody: "",
    wifiSsid: "", wifiPass: "", wifiAuth: "WPA", wifiHidden: false,
    vcFirst: "", vcLast: "", vcOrg: "", vcTitle: "", vcTel: "", vcTel2: "",
    vcEmail: "", vcUrl: "", vcAddr: "", vcNote: "",
    geoLat: "", geoLng: "",
  });
  const set = (k: keyof Fields) => (v: any) => setD((p) => ({ ...p, [k]: v }));

  const [design, setDesign] = useState(DEFAULT_DESIGN);
  const sd = (k: keyof Design) => (v: any) => setDesign((p) => ({ ...p, [k]: v }));

  const [logo, setLogo] = useState(DEFAULT_LOGO);
  const [presetMsg, setPresetMsg] = useState("");
  const sl = (k: keyof Logo) => (v: any) => setLogo((p) => ({ ...p, [k]: v }));

  const payload = useMemo(() => buildPayload(type, d), [type, d]);

  const qr = useMemo<QrState>(() => {
    if (!payload) return { ok: false, empty: true };
    try {
      return { ok: true, ...encodeQR(payload, design.ecc) };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }, [payload, design.ecc]);

  const svg = useMemo(
    () => (qr.ok ? buildSvg(qr, design, logo, null) : ""),
    [qr, design, logo]
  );
  const report = useMemo(
    () => (qr.ok ? inspect(qr, design, logo) : null),
    [qr, design, logo]
  );
  const eccVersions = useMemo(
    () =>
      payload
        ? { L: versionFor(payload, "L"), M: versionFor(payload, "M"), Q: versionFor(payload, "Q"), H: versionFor(payload, "H") }
        : null,
    [payload]
  );

  /* ---------- 내보내기 ---------- */
  const [busy, setBusy] = useState("");

  const download = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  const baseName = () =>
    `optiqr-${type}-${new Date().toISOString().slice(0, 10)}`;

  const exportSvg = () => {
    if (!qr.ok) return;
    const s = buildSvg(qr, design, logo, design.size);
    download(new Blob([s], { type: "image/svg+xml;charset=utf-8" }), baseName() + ".svg");
  };

  const exportPng = async () => {
    if (!qr.ok) return;
    setBusy("png");
    try {
      const s = buildSvg(qr, design, logo, design.size);
      const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(s);
      const img = new Image();
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = () => rej(new Error("SVG 래스터화 실패"));
        img.src = url;
      });
      const cv = document.createElement("canvas");
      cv.width = design.size;
      cv.height = design.size;
      const ctx = cv.getContext("2d")!;
      if (!design.bgTransparent) {
        ctx.fillStyle = design.bg;
        ctx.fillRect(0, 0, design.size, design.size);
      }
      ctx.drawImage(img, 0, 0, design.size, design.size);
      await new Promise<void>((res) =>
        cv.toBlob((b) => {
          if (b) download(b, baseName() + ".png");
          res();
        }, "image/png")
      );
    } catch (e) {
      alert("PNG 내보내기에 실패했습니다: " + (e as Error).message);
    }
    setBusy("");
  };

  const onLogoFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > 1024 * 1024) {
      alert("로고 파일은 1MB 이하를 권장합니다. 더 작은 파일을 선택하세요.");
      return;
    }
    const r = new FileReader();
    r.onload = () =>
      setLogo((p) => ({ ...p, src: r.result as string, name: file.name }));
    r.readAsDataURL(file);
  };

  /* ---------- 프리셋 (파일로만 보관, 브라우저에는 아무것도 남기지 않음) ---------- */
  const flash = (m: string) => {
    setPresetMsg(m);
    setTimeout(() => setPresetMsg(""), 4000);
  };

  const exportPreset = () => {
    const preset = {
      app: "holorado-optiqr",
      presetVersion: 1,
      savedAt: new Date().toISOString(),
      design,
      logo,
    };
    download(
      new Blob([JSON.stringify(preset, null, 2)], { type: "application/json" }),
      `optiqr-preset-${new Date().toISOString().slice(0, 10)}.json`
    );
    flash("프리셋을 저장했습니다.");
  };

  const importPreset = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const p = JSON.parse(r.result as string);
        if (!p || (p.app !== "holorado-optiqr" && p.app !== "holorado-qr-studio"))
          throw new Error("OptiQR 프리셋 파일이 아닙니다.");
        setDesign(coerce(p.design, DESIGN_SPEC, DEFAULT_DESIGN));
        setLogo(coerce(p.logo, LOGO_SPEC, DEFAULT_LOGO));
        flash("프리셋을 적용했습니다.");
      } catch (err) {
        flash("불러오지 못했습니다. " + (err as Error).message);
      }
    };
    r.onerror = () => flash("파일을 읽지 못했습니다.");
    r.readAsText(file);
  };

  /* ---------- 렌더 ---------- */
  const gradeColor = !report
    ? C.green
    : report.fatal || report.grade === "D"
    ? C.red
    : report.grade === "A"
    ? C.green
    : C.amber;
  const levelColor: Record<Level, string> = {
    error: C.red,
    warn: C.amber,
    info: C.greenSoft,
    ok: C.greenSoft,
  };
  const levelMark: Record<Level, string> = { error: "!", warn: "!", info: "i", ok: "✓" };
  const levelLabel: Record<Level, string> = {
    error: "오류",
    warn: "주의",
    info: "참고",
    ok: "정상",
  };

  return (
    <div className="min-h-screen w-full" style={{ background: C.cream, fontFamily: FONT, color: C.ink }}>
      {/* 헤더 */}
      <header style={{ borderBottom: `1px solid ${C.line}`, background: C.paper }}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-3 px-5 py-5">
          <div>
            <div className="flex items-baseline gap-2">
              <h1 className="text-xl font-bold tracking-tight">OptiQR</h1>
              <span className="text-xs" style={{ color: C.terra, fontFamily: MONO }}>
                Phase 1
              </span>
            </div>
            <p className="mt-1 text-xs" style={{ color: C.inkSoft }}>
              브라우저에서만 동작합니다. 입력한 데이터는 서버로 전송되지 않습니다.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs" style={{ color: C.inkSoft }}>
            <span
              className="rounded px-2 py-1"
              style={{ background: C.greenPale, color: C.green, fontFamily: MONO }}
            >
              holorado.me
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-5 px-5 py-6 lg:grid-cols-5">
        {/* ------------------ 좌: 컨트롤 ------------------ */}
        <div className="space-y-4 lg:col-span-3">
          <Seg
            options={[
              { value: "data", label: "데이터" },
              { value: "design", label: "디자인" },
              { value: "logo", label: "로고·여백" },
            ]}
            value={tab}
            onChange={setTab}
          />

          {tab === "data" && (
            <Card>
              <Label>데이터 종류</Label>
              <Seg options={TYPES} value={type} onChange={setType} columns={4} />

              <div className="mt-5 space-y-4">
                {type === "url" && (
                  <div>
                    <Label hint="스킴을 생략하면 https:// 를 붙입니다">주소</Label>
                    <TextInput value={d.url} onChange={set("url")} placeholder="holorado.me" mono />
                  </div>
                )}

                {type === "text" && (
                  <div>
                    <Label hint={`${(d.text || "").length}자`}>텍스트</Label>
                    <TextInput value={d.text} onChange={set("text")} multiline rows={5} placeholder="QR에 담을 문구" />
                  </div>
                )}

                {type === "email" && (
                  <>
                    <div>
                      <Label>받는 사람</Label>
                      <TextInput value={d.emailTo} onChange={set("emailTo")} placeholder="hello@holorado.me" mono />
                    </div>
                    <div>
                      <Label>제목</Label>
                      <TextInput value={d.emailSubject} onChange={set("emailSubject")} placeholder="문의드립니다" />
                    </div>
                    <div>
                      <Label>본문</Label>
                      <TextInput value={d.emailBody} onChange={set("emailBody")} multiline />
                    </div>
                  </>
                )}

                {type === "tel" && (
                  <div>
                    <Label hint="국가번호 포함 권장">전화번호</Label>
                    <TextInput value={d.tel} onChange={set("tel")} placeholder="+821012345678" mono />
                  </div>
                )}

                {type === "sms" && (
                  <>
                    <div>
                      <Label>받는 번호</Label>
                      <TextInput value={d.smsTo} onChange={set("smsTo")} placeholder="+821012345678" mono />
                    </div>
                    <div>
                      <Label>메시지</Label>
                      <TextInput value={d.smsBody} onChange={set("smsBody")} multiline rows={2} />
                    </div>
                  </>
                )}

                {type === "wifi" && (
                  <>
                    <div>
                      <Label>네트워크 이름 (SSID)</Label>
                      <TextInput value={d.wifiSsid} onChange={set("wifiSsid")} placeholder="HOLORADO-5G" mono />
                    </div>
                    <div>
                      <Label>보안 방식</Label>
                      <Seg
                        options={[
                          { value: "WPA", label: "WPA/WPA2" },
                          { value: "WEP", label: "WEP" },
                          { value: "nopass", label: "없음" },
                        ]}
                        value={d.wifiAuth}
                        onChange={set("wifiAuth")}
                      />
                    </div>
                    {d.wifiAuth !== "nopass" && (
                      <div>
                        <Label>비밀번호</Label>
                        <TextInput value={d.wifiPass} onChange={set("wifiPass")} mono />
                      </div>
                    )}
                    <Check checked={d.wifiHidden} onChange={set("wifiHidden")}>
                      숨겨진 네트워크
                    </Check>
                    <p className="text-xs" style={{ color: C.inkSoft }}>
                      비밀번호는 QR 안에 평문으로 들어갑니다. 외부에 붙이는 용도라면 게스트 네트워크를 쓰세요.
                    </p>
                  </>
                )}

                {type === "vcard" && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>이름</Label>
                        <TextInput value={d.vcFirst} onChange={set("vcFirst")} placeholder="길동" />
                      </div>
                      <div>
                        <Label>성</Label>
                        <TextInput value={d.vcLast} onChange={set("vcLast")} placeholder="홍" />
                      </div>
                      <div>
                        <Label>회사</Label>
                        <TextInput value={d.vcOrg} onChange={set("vcOrg")} />
                      </div>
                      <div>
                        <Label>직함</Label>
                        <TextInput value={d.vcTitle} onChange={set("vcTitle")} />
                      </div>
                      <div>
                        <Label>휴대전화</Label>
                        <TextInput value={d.vcTel} onChange={set("vcTel")} mono />
                      </div>
                      <div>
                        <Label>사무실</Label>
                        <TextInput value={d.vcTel2} onChange={set("vcTel2")} mono />
                      </div>
                      <div>
                        <Label>이메일</Label>
                        <TextInput value={d.vcEmail} onChange={set("vcEmail")} mono />
                      </div>
                      <div>
                        <Label>웹사이트</Label>
                        <TextInput value={d.vcUrl} onChange={set("vcUrl")} mono />
                      </div>
                    </div>
                    <div>
                      <Label>주소</Label>
                      <TextInput value={d.vcAddr} onChange={set("vcAddr")} />
                    </div>
                    <div>
                      <Label>메모</Label>
                      <TextInput value={d.vcNote} onChange={set("vcNote")} multiline rows={2} />
                    </div>
                  </>
                )}

                {type === "geo" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>위도</Label>
                      <TextInput value={d.geoLat} onChange={set("geoLat")} placeholder="37.5665" mono />
                    </div>
                    <div>
                      <Label>경도</Label>
                      <TextInput value={d.geoLng} onChange={set("geoLng")} placeholder="126.9780" mono />
                    </div>
                  </div>
                )}
              </div>

              {payload && (
                <div className="mt-5">
                  <Label hint={`${toUtf8(payload).length} bytes`}>인코딩 결과</Label>
                  <pre
                    className="max-h-28 overflow-auto whitespace-pre-wrap break-all rounded p-3 text-xs"
                    style={{ background: C.cream, border: `1px solid ${C.line}`, color: C.inkSoft, fontFamily: MONO }}
                  >
                    {payload}
                  </pre>
                </div>
              )}
            </Card>
          )}

          {tab === "design" && (
            <>
              <Card>
                <Label>모듈 색상</Label>
                <Seg
                  options={[
                    { value: "solid", label: "단색" },
                    { value: "gradient", label: "그라데이션" },
                  ]}
                  value={design.fgMode}
                  onChange={sd("fgMode")}
                />
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <ColorField value={design.fg} onChange={sd("fg")} />
                  {design.fgMode === "gradient" && (
                    <ColorField value={design.fg2} onChange={sd("fg2")} />
                  )}
                </div>
                {design.fgMode === "gradient" && (
                  <div className="mt-4 space-y-3">
                    <Seg
                      options={[
                        { value: "linear", label: "선형" },
                        { value: "radial", label: "원형" },
                      ]}
                      value={design.gradType}
                      onChange={sd("gradType")}
                    />
                    {design.gradType === "linear" && (
                      <div>
                        <Label>각도</Label>
                        <Slider
                          value={design.gradAngle}
                          min={0}
                          max={360}
                          step={5}
                          onChange={sd("gradAngle")}
                          format={(v) => v + "°"}
                        />
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-5">
                  <Label>배경</Label>
                  <div className="flex flex-wrap items-center gap-4">
                    <ColorField value={design.bg} onChange={sd("bg")} disabled={design.bgTransparent} />
                    <Check checked={design.bgTransparent} onChange={sd("bgTransparent")}>
                      투명
                    </Check>
                  </div>
                </div>
              </Card>

              <Card>
                <Label hint="모듈 모양">Dot 스타일</Label>
                <Seg
                  options={[
                    { value: "square", label: "각짐" },
                    { value: "rounded", label: "둥근" },
                    { value: "extra", label: "많이 둥근" },
                    { value: "dots", label: "점" },
                    { value: "classy", label: "클래시" },
                    { value: "fluid", label: "연결" },
                  ]}
                  value={design.dotStyle}
                  onChange={sd("dotStyle")}
                  columns={3}
                />

                <div className="mt-5">
                  <Label hint="위치 검출 패턴">Eye 스타일</Label>
                  <Seg
                    options={[
                      { value: "square", label: "각짐" },
                      { value: "rounded", label: "둥근" },
                      { value: "circle", label: "원형" },
                      { value: "leaf", label: "잎사귀" },
                    ]}
                    value={design.eyeStyle}
                    onChange={sd("eyeStyle")}
                    columns={4}
                  />
                </div>

                <div className="mt-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Check checked={!design.eyeOuterAuto} onChange={(v) => sd("eyeOuterAuto")(!v)}>
                      Eye 프레임 색상 지정
                    </Check>
                    <ColorField
                      value={design.eyeOuterColor}
                      onChange={sd("eyeOuterColor")}
                      disabled={design.eyeOuterAuto}
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Check checked={!design.eyeInnerAuto} onChange={(v) => sd("eyeInnerAuto")(!v)}>
                      Eye 중심 색상 지정
                    </Check>
                    <ColorField
                      value={design.eyeInnerColor}
                      onChange={sd("eyeInnerColor")}
                      disabled={design.eyeInnerAuto}
                    />
                  </div>
                </div>
              </Card>
            </>
          )}

          {tab === "logo" && (
            <>
              <Card>
                <Label hint="PNG · SVG · JPG, 1MB 이하">중앙 로고</Label>
                <div className="flex flex-wrap items-center gap-3">
                  <label
                    className="cursor-pointer rounded px-3 py-2 text-xs font-medium"
                    style={{ background: C.green, color: C.paper }}
                  >
                    파일 선택
                    <input type="file" accept="image/*" className="hidden" onChange={onLogoFile} />
                  </label>
                  {logo.src && (
                    <>
                      <span className="text-xs" style={{ color: C.inkSoft }}>
                        {logo.name}
                      </span>
                      <button
                        onClick={() => setLogo((p) => ({ ...p, src: null, name: "" }))}
                        className="text-xs underline"
                        style={{ color: C.terra }}
                      >
                        제거
                      </button>
                    </>
                  )}
                </div>

                {logo.src && (
                  <div className="mt-5 space-y-4">
                    <div>
                      <Label>로고 크기</Label>
                      <Slider
                        value={logo.sizePct}
                        min={0.08}
                        max={0.4}
                        step={0.01}
                        onChange={sl("sizePct")}
                        format={(v) => (v * 100).toFixed(0) + "%"}
                      />
                    </div>
                    <div>
                      <Label hint="로고 주변에 비우는 공간">보호 여백</Label>
                      <Slider
                        value={logo.pad}
                        min={0}
                        max={0.08}
                        step={0.005}
                        onChange={sl("pad")}
                        format={(v) => (v * 100).toFixed(1) + "%"}
                      />
                    </div>
                    {logo.pad > 0 && (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <Seg
                          options={[
                            { value: "circle", label: "원형" },
                            { value: "square", label: "사각" },
                          ]}
                          value={logo.padShape}
                          onChange={sl("padShape")}
                        />
                        <ColorField value={logo.padColor} onChange={sl("padColor")} />
                      </div>
                    )}
                  </div>
                )}
              </Card>

              <Card>
                <Label hint="규격 최소 4모듈">Quiet Zone</Label>
                <Slider
                  value={design.quietZone}
                  min={0}
                  max={10}
                  step={1}
                  onChange={sd("quietZone")}
                  format={(v) => v + "모듈"}
                />

                <div className="mt-5">
                  <Label hint="가려지거나 훼손돼도 복원되는 비율">오류 정정 수준 (ECC)</Label>
                  <Seg
                    options={[
                      { value: "L", label: "L · 7%" },
                      { value: "M", label: "M · 15%" },
                      { value: "Q", label: "Q · 25%" },
                      { value: "H", label: "H · 30%" },
                    ]}
                    value={design.ecc}
                    onChange={sd("ecc")}
                  />

                  {eccVersions && (
                    <div className="mt-2 grid grid-cols-4 gap-1">
                      {(["L", "M", "Q", "H"] as Ecl[]).map((k) => {
                        const v = eccVersions[k];
                        const cur = k === design.ecc;
                        return (
                          <div
                            key={k}
                            className="text-center text-xs tabular-nums"
                            style={{
                              color: cur ? C.green : C.inkSoft,
                              opacity: cur ? 1 : 0.6,
                              fontFamily: MONO,
                              fontWeight: cur ? 700 : 400,
                            }}
                          >
                            {v ? `${v * 4 + 17}칸` : "초과"}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div
                    className="mt-3 rounded p-3 text-xs leading-relaxed"
                    style={{ background: C.greenPale, color: C.ink }}
                  >
                    <div className="font-semibold" style={{ color: C.green }}>
                      {design.ecc} · {ECC_INFO[design.ecc].pct} 복원 — {ECC_INFO[design.ecc].use}
                    </div>
                    <p className="mt-1" style={{ color: C.inkSoft }}>
                      {ECC_INFO[design.ecc].desc}
                    </p>
                  </div>

                  <p className="mt-2 text-xs leading-relaxed" style={{ color: C.inkSoft }}>
                    QR은 데이터와 함께 복원용 정보를 같이 담습니다. 수준을 올리면 일부가 가려져도
                    읽히지만, 그만큼 칸이 늘어 QR이 촘촘해지고 스캔 거리가 짧아집니다. 위 숫자는 지금
                    데이터를 각 수준으로 담았을 때의 한 변 칸 수입니다.
                  </p>
                </div>

                <div className="mt-5">
                  <Label hint="PNG 내보내기 크기">이미지 크기</Label>
                  <Slider
                    value={design.size}
                    min={256}
                    max={2048}
                    step={64}
                    onChange={sd("size")}
                    format={(v) => v + "px"}
                  />
                </div>
              </Card>
            </>
          )}

          <Card>
            <Label hint="브라우저에 저장하지 않습니다">프리셋</Label>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={exportPreset}
                className="rounded px-3 py-2 text-xs font-semibold"
                style={{ background: C.green, color: C.paper }}
              >
                프리셋 저장
              </button>
              <label
                className="cursor-pointer rounded px-3 py-2 text-xs font-semibold"
                style={{ background: C.paper, color: C.green, border: `1.5px solid ${C.green}` }}
              >
                프리셋 불러오기
                <input
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={importPreset}
                />
              </label>
              <button
                onClick={() => {
                  setDesign(DEFAULT_DESIGN);
                  setLogo(DEFAULT_LOGO);
                  flash("기본값으로 되돌렸습니다.");
                }}
                className="text-xs underline"
                style={{ color: C.terra }}
              >
                기본값으로
              </button>
            </div>
            {presetMsg && (
              <p className="mt-2.5 text-xs" style={{ color: C.greenSoft }}>
                {presetMsg}
              </p>
            )}
            <p className="mt-2.5 text-xs leading-relaxed" style={{ color: C.inkSoft }}>
              색상·Dot·Eye·로고·Quiet Zone·ECC·크기가 JSON 파일 하나로 저장됩니다. 입력한 URL이나
              연락처는 들어가지 않으니 팀에 그대로 공유해도 됩니다.
            </p>
          </Card>
        </div>

        {/* ------------------ 우: 미리보기 + 검사 ------------------ */}
        <div className="lg:col-span-2">
          <div className="space-y-4 lg:sticky lg:top-5">
            <Card style={{ padding: 20 }}>
              <div
                className="flex aspect-square w-full items-center justify-center rounded"
                style={{
                  background: design.bgTransparent
                    ? "repeating-conic-gradient(#EDE7D8 0% 25%, #FFFDF7 0% 50%) 50% / 16px 16px"
                    : C.cream,
                  border: `1px solid ${C.line}`,
                  padding: 12,
                }}
              >
                {qr.ok ? (
                  <div
                    className="h-full w-full"
                    style={{ lineHeight: 0 }}
                    dangerouslySetInnerHTML={{ __html: svg.replace("<svg ", '<svg width="100%" height="100%" ') }}
                  />
                ) : (
                  <p className="px-6 text-center text-xs" style={{ color: C.inkSoft }}>
                    {qr.empty
                      ? "데이터를 입력하면 여기에서 QR이 바로 그려집니다."
                      : qr.error}
                  </p>
                )}
              </div>

              {qr.ok && (
                <div
                  className="mt-3 flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs"
                  style={{ color: C.inkSoft, fontFamily: MONO }}
                >
                  <span>v{qr.version} · {qr.size}×{qr.size}</span>
                  <span>{qr.mode === "byte" ? "BYTE" : qr.mode === "alnum" ? "ALNUM" : "NUM"} · ECC {qr.ecl}</span>
                  <span>용량 {(qr.usage * 100).toFixed(0)}%</span>
                </div>
              )}

              {report && report.fatal && (
                <div
                  className="mt-3 rounded px-3 py-2.5 text-xs font-semibold leading-relaxed"
                  style={{ background: "#F6E3E1", color: C.red, border: "1px solid #E9C9C4" }}
                >
                  지금 설정으로는 스캔되지 않습니다. 아래 오류 항목을 먼저 고치세요.
                </div>
              )}

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  onClick={exportPng}
                  disabled={!qr.ok || busy === "png"}
                  className="rounded px-3 py-2.5 text-sm font-semibold transition-opacity"
                  style={{
                    background: C.green,
                    color: C.paper,
                    opacity: qr.ok && busy !== "png" ? 1 : 0.45,
                  }}
                >
                  {busy === "png" ? "내보내는 중…" : "PNG 저장"}
                </button>
                <button
                  onClick={exportSvg}
                  disabled={!qr.ok}
                  className="rounded px-3 py-2.5 text-sm font-semibold"
                  style={{
                    background: C.paper,
                    color: C.green,
                    border: `1.5px solid ${C.green}`,
                    opacity: qr.ok ? 1 : 0.45,
                  }}
                >
                  SVG 저장
                </button>
              </div>

              {qr.ok && (
                <div
                  className="mt-3 rounded p-3 text-xs leading-relaxed"
                  style={{ background: C.greenPale, color: C.inkSoft }}
                >
                  <span className="font-semibold" style={{ color: C.green }}>
                    저장하기 전에 휴대폰으로 한 번 찍어 보세요.
                  </span>{" "}
                  위 미리보기를 카메라로 그대로 비추면 됩니다. 검사 점수는 계산에 근거한 예측이라
                  기종·카메라·조명에 따라 결과가 다를 수 있습니다. 인쇄물이라면 실제 크기로 뽑아
                  사용할 거리에서 다시 확인하세요.
                </div>
              )}
            </Card>

            {/* 품질 검사 */}
            {report && (
              <Card>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold tracking-wide" style={{ color: C.inkSoft }}>
                      스캔 품질 검사
                    </div>
                    <div className="mt-0.5 text-xs" style={{ color: C.inkSoft, opacity: 0.75 }}>
                      설정을 바꾸면 즉시 다시 계산합니다
                    </div>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span
                      className="text-2xl font-bold tabular-nums"
                      style={{ color: gradeColor, fontFamily: MONO }}
                    >
                      {report.score}
                    </span>
                    <span
                      className="rounded px-1.5 py-0.5 text-xs font-bold"
                      style={{
                        background: report.fatal
                          ? "#F6E3E1"
                          : report.grade === "A"
                          ? C.greenPale
                          : C.terraPale,
                        color: gradeColor,
                      }}
                    >
                      {report.grade}
                    </span>
                  </div>
                </div>

                <div
                  className="mb-4 h-1.5 w-full overflow-hidden rounded"
                  style={{ background: C.cream }}
                >
                  <div
                    className="h-full rounded transition-all"
                    style={{
                      width: report.score + "%",
                      background: gradeColor,
                    }}
                  />
                </div>

                <ul className="space-y-2.5">
                  {report.items.map((it, i) => (
                    <li key={i} className="flex gap-2.5">
                      <span
                        className="mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full text-xs font-bold"
                        style={{
                          background: it.level === "ok" ? C.greenPale : it.level === "error" ? "#F6E3E1" : C.terraPale,
                          color: levelColor[it.level],
                          fontSize: 9,
                        }}
                      >
                        {levelMark[it.level]}
                      </span>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold" style={{ color: C.ink }}>
                          {it.title}
                          <span
                            className="ml-1.5 font-normal"
                            style={{ color: levelColor[it.level], fontSize: 10 }}
                          >
                            {levelLabel[it.level]}
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs leading-relaxed" style={{ color: C.inkSoft }}>
                          {it.detail}
                        </div>
                        {it.fix && (
                          <div
                            className="mt-1 text-xs leading-relaxed"
                            style={{ color: C.greenSoft }}
                          >
                            → {it.fix}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>

                <p className="mt-4 text-xs leading-relaxed" style={{ color: C.inkSoft, opacity: 0.8 }}>
                  이 점수는 QR 규격과 명암비 계산에 근거한 예측입니다. 실제 인식 여부를 보장하지는
                  않습니다.
                </p>
              </Card>
            )}
          </div>
        </div>
      </main>

      {/* 완료 기준 */}
      <footer className="mx-auto max-w-6xl px-5 pb-12">
        <button
          onClick={() => setShowCriteria((v) => !v)}
          className="mb-3 text-xs font-semibold"
          style={{ color: C.green }}
        >
          {showCriteria ? "▾" : "▸"} Phase 1 완료 기준
        </button>
        {showCriteria && (
          <Card>
            <ol className="space-y-2 text-xs leading-relaxed" style={{ color: C.inkSoft }}>
              {[
                "8종 데이터 타입 각각에서 실제 기기 스캔이 성공한다 (URL·텍스트·이메일·전화·SMS·WiFi·명함·위치).",
                "입력·디자인 변경 시 재생성 버튼 없이 미리보기가 즉시 갱신된다.",
                "Dot 6종 × Eye 4종 조합에서 QR이 깨지지 않고, 로고 20% + ECC H 조합이 스캔된다.",
                "PNG·SVG 다운로드가 모두 동작하고, SVG를 브라우저에서 열었을 때 미리보기와 동일하다.",
                "품질 검사가 명암비·로고 크기·Quiet Zone·Eye 대비·ECC·모듈 해상도·데이터 과다를 실시간으로 판정한다.",
                "의도적으로 나쁜 설정(명암비 2:1, Quiet Zone 0, 로고 40%)을 만들면 오류 등급이 뜨고, 실제로도 스캔에 실패한다.",
                "프리셋을 저장한 뒤 기본값으로 되돌렸다가 다시 불러오면 디자인이 그대로 복원되고, 파일 안에 입력 데이터가 들어 있지 않다.",
                "손으로 망가뜨린 프리셋 파일(값 범위 초과·타입 오류·원격 이미지 URL)을 불러와도 앱이 죽지 않고 기본값으로 대체된다.",
                "네트워크 탭에 외부 요청이 0건이다.",
                "모바일 폭 375px에서 레이아웃이 무너지지 않는다.",
              ].map((t, i) => (
                <li key={i} className="flex gap-2">
                  <span style={{ color: C.terra, fontFamily: MONO }}>{String(i + 1).padStart(2, "0")}</span>
                  <span>{t}</span>
                </li>
              ))}
            </ol>
          </Card>
        )}
      </footer>
    </div>
  );
}
