import { Card } from "./ui";
import { C, MONO } from "../lib/brand";
import type { Level, Report } from "../lib/qr/types";

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

export function QualityPanel({ report }: { report: Report | null }) {
  if (!report) return null;

  const gradeColor = report.fatal || report.grade === "D"
    ? C.red
    : report.grade === "A"
    ? C.green
    : C.amber;

  return (
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
        이 점수는 QR 규격과 명암비 계산에 근거한 예측이며, 인쇄·오염·저조도까지 감안해 보수적으로
        판정합니다. 실제 인식 여부를 보장하지도, 실패를 단정하지도 않습니다.
      </p>
    </Card>
  );
}
