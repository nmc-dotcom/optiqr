/* =========================================================================
   로고 임계값 검증 — 요약판 (완료 기준 7번)

   CSV를 거치지 않고 결과를 직접 출력한다.
   PowerShell 5.1은 UTF-8 CSV를 ANSI로 읽어 한글 헤더가 깨지므로,
   출력은 전부 ASCII로 맞췄다.

   실행:  npx tsx scripts/threshold-summary.ts
   ========================================================================= */

import jsQR from "jsqr";
import { encodeQR } from "../src/lib/qr/encoder";
import { inspect } from "../src/lib/qr/inspect";
import { DEFAULT_DESIGN, DEFAULT_LOGO } from "../src/lib/qr/preset";
import type { Design, Logo, Ecl, QRResult } from "../src/lib/qr/types";

function decodeWithLogo(
  qr: QRResult,
  sizePct: number,
  pad: number,
  scale: number,
  quiet = 4
): boolean {
  const n = qr.size + quiet * 2;
  const w = n * scale;
  const buf = new Uint8ClampedArray(w * w * 4).fill(255);

  for (let y = 0; y < qr.size; y++) {
    for (let x = 0; x < qr.size; x++) {
      if (!qr.modules[y][x]) continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const px = ((y + quiet) * scale + dy) * w + ((x + quiet) * scale + dx);
          buf[px * 4] = buf[px * 4 + 1] = buf[px * 4 + 2] = 0;
        }
      }
    }
  }

  const half = ((sizePct * qr.size) / 2 + pad * qr.size) * scale;
  const c = (n * scale) / 2;
  for (let py = 0; py < w; py++) {
    for (let px = 0; px < w; px++) {
      const dx = px + 0.5 - c;
      const dy = py + 0.5 - c;
      if (dx * dx + dy * dy > half * half) continue;
      const i = (py * w + px) * 4;
      buf[i] = buf[i + 1] = buf[i + 2] = 255;
    }
  }
  return !!jsQR(buf, w, w);
}

function verdict(qr: QRResult, design: Design, logo: Logo): "ok" | "warn" | "error" {
  const r = inspect(qr, design, logo);
  const items = r.items.filter(
    (i) =>
      i.title.includes("로고") ||
      i.title.includes("기능 패턴") ||
      i.title.includes("정렬 패턴") ||
      i.title.includes("복원")
  );
  if (items.some((i) => i.level === "error")) return "error";
  if (items.some((i) => i.level === "warn")) return "warn";
  return "ok";
}

/* ---------------------------------------------------------------------- */

const TARGETS: { label: string; text: string }[] = [
  { label: "short-url", text: "https://holorado.me" },
  { label: "long-url", text: "https://qr.holorado.me/?utm_source=nfc&utm_campaign=2026q3" },
  { label: "vcard", text: "BEGIN:VCARD\nVERSION:3.0\nN:Hong;Gildong;;;\nFN:Gildong Hong\nORG:Narawon\nTEL;TYPE=CELL:+821012345678\nEMAIL:hong@example.co.kr\nEND:VCARD" },
  { label: "long-text", text: "a".repeat(300) },
];
const LEVELS: Ecl[] = ["Q", "H"];
const PAD = 0.03;
const SCALES = [4, 8];

interface Row {
  pct: number;
  verdict: string;
  decoded: boolean;
}

let falseSafeTotal = 0;
let rowTotal = 0;

console.log("");
console.log("target      ECC  ver  modules   real-limit  warn-at  error-at  gap  FALSE-SAFE");
console.log("---------------------------------------------------------------------------------");

for (const { label, text } of TARGETS) {
  for (const ecl of LEVELS) {
    const qr = encodeQR(text, ecl);
    const design: Design = { ...DEFAULT_DESIGN, ecc: ecl };
    const rows: Row[] = [];

    for (let pct = 5; pct <= 40; pct++) {
      const sizePct = pct / 100;
      const logo: Logo = {
        ...DEFAULT_LOGO,
        src: "data:image/png;base64,iVBORw0KGgo=",
        sizePct,
        pad: PAD,
        padShape: "circle",
      };
      rows.push({
        pct,
        verdict: verdict(qr, design, logo),
        decoded: SCALES.every((s) => decodeWithLogo(qr, sizePct, PAD, s)),
      });
      rowTotal++;
    }

    // 실제 한계: 여기까지는 연속으로 읽히는 최대 크기
    let realLimit = 0;
    for (const r of rows) {
      if (!r.decoded) break;
      realLimit = r.pct;
    }
    const warnAt = rows.find((r) => r.verdict !== "ok")?.pct ?? 0;
    const errorAt = rows.find((r) => r.verdict === "error")?.pct ?? 0;

    // 거짓 안심: 검사기가 오류가 아닌데 디코딩 실패
    const falseSafe = rows.filter((r) => r.verdict !== "error" && !r.decoded);
    falseSafeTotal += falseSafe.length;

    console.log(
      [
        label.padEnd(11),
        ecl.padEnd(4),
        String(qr.version).padStart(3),
        `${qr.size}x${qr.size}`.padStart(8),
        `${realLimit}%`.padStart(11),
        `${warnAt}%`.padStart(8),
        `${errorAt}%`.padStart(9),
        `${errorAt - realLimit}`.padStart(5),
        falseSafe.length
          ? ` YES -> ${falseSafe.map((r) => r.pct + "%").join(",")}`
          : " none",
      ].join("")
    );
  }
}

console.log("---------------------------------------------------------------------------------");
console.log(`rows: ${rowTotal}   false-safe rows: ${falseSafeTotal}`);
console.log("");
console.log("real-limit : largest logo size that still decodes (jsQR)");
console.log("error-at   : smallest logo size the inspector marks as an error");
console.log("gap        : error-at minus real-limit.");
console.log("             negative = inspector is conservative (safe)");
console.log("             positive = inspector allows sizes that do not decode (BAD)");
console.log("FALSE-SAFE : inspector said it is fine but decoding failed. must be none.");
