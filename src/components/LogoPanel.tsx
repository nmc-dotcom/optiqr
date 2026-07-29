import type { ChangeEvent } from "react";
import { Card, ColorField, Label, Seg, Slider } from "./ui";
import { C, MONO } from "../lib/brand";
import { ECC_INFO } from "../lib/qr/inspect";
import type { Design, Ecl, Logo } from "../lib/qr/types";

export function LogoPanel({
  design,
  sd,
  logo,
  setLogo,
  sl,
  onLogoFile,
  eccVersions,
}: {
  design: Design;
  sd: (k: keyof Design) => (v: any) => void;
  logo: Logo;
  setLogo: (updater: (p: Logo) => Logo) => void;
  sl: (k: keyof Logo) => (v: any) => void;
  onLogoFile: (e: ChangeEvent<HTMLInputElement>) => void;
  eccVersions: Record<Ecl, number | null> | null;
}) {
  return (
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
  );
}
