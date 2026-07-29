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

export type SpecEntry = [string, any?, any?];
export type Spec = Record<string, SpecEntry>;
