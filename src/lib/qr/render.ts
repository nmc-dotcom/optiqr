import type { Design, Logo, QRResult } from "./types";

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

export function buildSvg(
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
