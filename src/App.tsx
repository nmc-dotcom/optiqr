import { useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { C, FONT, MONO } from "./lib/brand";
import { buildPayload } from "./lib/qr/payload";
import { encodeQR } from "./lib/qr/encoder";
import { buildSvg } from "./lib/qr/render";
import { inspect, versionFor } from "./lib/qr/inspect";
import { coerce, DEFAULT_DESIGN, DEFAULT_LOGO, DESIGN_SPEC, LOGO_SPEC } from "./lib/qr/preset";
import type { DataType, Design, Fields, Logo, QrState } from "./lib/qr/types";
import { Card, Seg } from "./components/ui";
import { DataPanel } from "./components/DataPanel";
import { DesignPanel } from "./components/DesignPanel";
import { LogoPanel } from "./components/LogoPanel";
import { PreviewPanel } from "./components/PreviewPanel";
import { QualityPanel } from "./components/QualityPanel";

export default function QRStudio() {
  const [tab, setTab] = useState("data");
  const [type, setType] = useState<DataType>("url");

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
  return (
    <div className="min-h-screen w-full" style={{ background: C.cream, fontFamily: FONT, color: C.ink }}>
      {/* 헤더 */}
      <header style={{ borderBottom: `1px solid ${C.line}`, background: C.paper }}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-3 px-5 py-5">
          <div>
            <h1 className="text-xl font-bold tracking-tight">OptiQR</h1>
            <p className="mt-1 text-xs" style={{ color: C.inkSoft }}>
              브라우저에서만 동작합니다. 입력한 데이터는 서버로 전송되지 않습니다.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs" style={{ color: C.inkSoft }}>
            <a
              href="https://holorado.me"
              className="rounded px-2 py-1 transition-opacity hover:opacity-80"
              style={{ background: C.greenPale, color: C.green, fontFamily: MONO }}
            >
              홀로라도 홈
            </a>
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
            <DataPanel type={type} setType={setType} d={d} set={set} payload={payload} />
          )}

          {tab === "design" && <DesignPanel design={design} sd={sd} />}

          {tab === "logo" && (
            <LogoPanel
              design={design}
              sd={sd}
              logo={logo}
              setLogo={setLogo}
              sl={sl}
              onLogoFile={onLogoFile}
              eccVersions={eccVersions}
            />
          )}

          <Card>
            <div className="mb-1.5 flex items-baseline justify-between gap-2">
              <span className="text-xs font-semibold tracking-wide" style={{ color: C.inkSoft }}>
                프리셋
              </span>
              <span className="text-xs" style={{ color: C.inkSoft, opacity: 0.7 }}>
                브라우저에 저장하지 않습니다
              </span>
            </div>
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
            <PreviewPanel
              design={design}
              qr={qr}
              svg={svg}
              report={report}
              busy={busy}
              exportPng={exportPng}
              exportSvg={exportSvg}
            />

            <QualityPanel report={report} />
          </div>
        </div>
      </main>

      <footer style={{ borderTop: `1px solid ${C.line}`, background: C.paper }}>
        <div className="mx-auto max-w-6xl px-5 py-8 text-center text-xs" style={{ color: C.inkSoft }}>
          <p>
            <span className="font-semibold" style={{ color: C.ink }}>
              OptiQR
            </span>{" "}
            · QR 코드를 만들고, 실제로 읽히는지 확인하세요
          </p>
          <p className="mt-2">© 2026 Holorado Tools Ecosystem. All Rights Reserved.</p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
            <a href="https://holorado.me" className="hover:underline" style={{ color: C.green }}>
              홀로라도 홈
            </a>
            <span style={{ color: C.line }}>·</span>
            <a
              href="https://holorado.me/privacy"
              target="_blank"
              rel="noreferrer"
              className="hover:underline"
              style={{ color: C.green }}
            >
              개인정보처리방침
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
