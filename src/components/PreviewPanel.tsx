import { Card } from "./ui";
import { C, MONO } from "../lib/brand";
import type { Design, QrState, Report } from "../lib/qr/types";

export function PreviewPanel({
  design,
  qr,
  svg,
  report,
  busy,
  exportPng,
  exportSvg,
}: {
  design: Design;
  qr: QrState;
  svg: string;
  report: Report | null;
  busy: string;
  exportPng: () => void;
  exportSvg: () => void;
}) {
  return (
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
  );
}
