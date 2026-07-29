import type { Design, Ecl, Issue, Level, Logo, QRResult, Report } from "./types";
import { ECL_ORD, ccBits, encodePayloadBits, numDataCodewords, pickMode } from "./encoder";

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

export const ECC_INFO: Record<Ecl, { pct: string; use: string; desc: string }> = {
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
export function versionFor(text: string, eclKey: Ecl): number | null {
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
export function logoDamage(qr: QRResult, logo: Logo, sizePct?: number) {
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
export function safeLogoSize(qr: QRResult, logo: Logo): number | null {
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

export function inspect(qr: QRResult, design: Design, logo: Logo): Report {
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
