/* =========================================================================
   로고 임계값 검증 (완료 기준 7번)

   검사기가 "안전"이라고 말하는 지점과 실제로 읽히는 지점이 일치하는지 본다.
   불일치의 두 방향은 의미가 다르다:

   - 검사기 ok / 디코딩 실패  → 거짓 안심. 반드시 고쳐야 함.
   - 검사기 error / 디코딩 성공 → 보수적 판정. 허용 범위지만
                                  폭이 너무 넓으면 쓸 수 있는 크기를 부당하게 막는 것.

   실행:  npx tsx scripts/threshold-check.ts > threshold.csv
   경로는 프로젝트 구조에 맞게 조정할 것.
   ========================================================================= */

import jsQR from "jsqr";
import { encodeQR } from "../src/lib/qr/encoder";
import { inspect } from "../src/lib/qr/inspect";
import { DEFAULT_DESIGN, DEFAULT_LOGO } from "../src/lib/qr/preset";
import type { Design, Logo, Ecl, QRResult } from "../src/lib/qr/types";

/** 로고 영역을 불투명하게 덮은 상태로 렌더링해 디코딩을 시도한다 */
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

  // 중앙에 로고(+보호 여백)만큼 흰 원을 칠한다 = 그 영역의 모듈이 사라진 상태
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

  const res = jsQR(buf, w, w);
  return !!res;
}

/** 로고 관련 검사 항목만 뽑아 등급을 판정한다 */
function verdict(qr: QRResult, design: Design, logo: Logo): "ok" | "warn" | "error" {
  const r = inspect(qr, design, logo);
  const logoItems = r.items.filter(
    (i) =>
      i.title.includes("로고") ||
      i.title.includes("기능 패턴") ||
      i.title.includes("정렬 패턴") ||
      i.title.includes("복원")
  );
  if (logoItems.some((i) => i.level === "error")) return "error";
  if (logoItems.some((i) => i.level === "warn")) return "warn";
  return "ok";
}

/* ---------------------------------------------------------------------- */

// 버전별로 결과가 다르므로 작은 것부터 큰 것까지 각각 본다
const TARGETS: { label: string; text: string }[] = [
  { label: "짧은 URL", text: "https://holorado.me" },
  { label: "중간 URL", text: "https://qr.holorado.me/?utm_source=nfc&utm_campaign=2026q3" },
  { label: "명함", text: "BEGIN:VCARD\nVERSION:3.0\nN:홍;길동;;;\nFN:길동 홍\nORG:나라원시스템\nTEL;TYPE=CELL:+821012345678\nEMAIL:hong@example.co.kr\nEND:VCARD" },
  { label: "긴 텍스트", text: "a".repeat(300) },
];
const LEVELS: Ecl[] = ["Q", "H"];
const PAD = 0.03;
const SCALES = [4, 8]; // 래스터화 아티팩트를 걸러내기 위해 두 배율에서 모두 확인

console.log("데이터,ECC,버전,모듈,로고%,검사기,디코딩,불일치");

for (const { label, text } of TARGETS) {
  for (const ecl of LEVELS) {
    const qr = encodeQR(text, ecl);
    const design: Design = { ...DEFAULT_DESIGN, ecc: ecl };

    for (let pct = 5; pct <= 40; pct++) {
      const sizePct = pct / 100;
      const logo: Logo = {
        ...DEFAULT_LOGO,
        // src가 있어야 검사기가 로고 항목을 평가한다. 실제 이미지는 불필요.
        src: "data:image/png;base64,iVBORw0KGgo=",
        sizePct,
        pad: PAD,
        padShape: "circle",
      };

      const v = verdict(qr, design, logo);
      const decoded = SCALES.every((s) => decodeWithLogo(qr, sizePct, PAD, s));

      // 거짓 안심(검사기 통과인데 실패)만 별도 표시
      const mismatch =
        v !== "error" && !decoded ? "거짓안심" : v === "error" && decoded ? "보수적" : "";

      console.log(
        [label, ecl, qr.version, `${qr.size}x${qr.size}`, pct, v, decoded ? "OK" : "실패", mismatch].join(",")
      );
    }
  }
}
