import { C } from "../brand";
import type { Design, Logo, Spec } from "./types";

export const DEFAULT_DESIGN: Design = {
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
export const DEFAULT_LOGO: Logo = {
  src: null,
  name: "",
  sizePct: 0.2,
  pad: 0.03,
  padShape: "circle",
  padColor: C.paper,
};

/* 프리셋 파일은 사용자가 편집할 수 있는 외부 입력이다.
   구조를 믿지 않고 알려진 키만, 알려진 범위로 좁혀서 받는다. */
export const DESIGN_SPEC: Spec = {
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
export const LOGO_SPEC: Spec = {
  sizePct: ["num", 0.08, 0.4],
  pad: ["num", 0, 0.08],
  padShape: ["enum", ["circle", "square"]],
  padColor: ["hex"],
  name: ["str"],
  src: ["dataurl"],
};

export function coerce<T>(raw: any, spec: Spec, defaults: T): T {
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
