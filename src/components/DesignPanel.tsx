import { Card, Check, ColorField, Label, Seg, Slider } from "./ui";
import type { Design } from "../lib/qr/types";

export function DesignPanel({
  design,
  sd,
}: {
  design: Design;
  sd: (k: keyof Design) => (v: any) => void;
}) {
  return (
    <>
      <Card>
        <Label>모듈 색상</Label>
        <Seg
          options={[
            { value: "solid", label: "단색" },
            { value: "gradient", label: "그라데이션" },
          ]}
          value={design.fgMode}
          onChange={sd("fgMode")}
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <ColorField value={design.fg} onChange={sd("fg")} />
          {design.fgMode === "gradient" && (
            <ColorField value={design.fg2} onChange={sd("fg2")} />
          )}
        </div>
        {design.fgMode === "gradient" && (
          <div className="mt-4 space-y-3">
            <Seg
              options={[
                { value: "linear", label: "선형" },
                { value: "radial", label: "원형" },
              ]}
              value={design.gradType}
              onChange={sd("gradType")}
            />
            {design.gradType === "linear" && (
              <div>
                <Label>각도</Label>
                <Slider
                  value={design.gradAngle}
                  min={0}
                  max={360}
                  step={5}
                  onChange={sd("gradAngle")}
                  format={(v) => v + "°"}
                />
              </div>
            )}
          </div>
        )}

        <div className="mt-5">
          <Label>배경</Label>
          <div className="flex flex-wrap items-center gap-4">
            <ColorField value={design.bg} onChange={sd("bg")} disabled={design.bgTransparent} />
            <Check checked={design.bgTransparent} onChange={sd("bgTransparent")}>
              투명
            </Check>
          </div>
        </div>
      </Card>

      <Card>
        <Label hint="모듈 모양">Dot 스타일</Label>
        <Seg
          options={[
            { value: "square", label: "각짐" },
            { value: "rounded", label: "둥근" },
            { value: "extra", label: "많이 둥근" },
            { value: "dots", label: "점" },
            { value: "classy", label: "클래시" },
            { value: "fluid", label: "연결" },
          ]}
          value={design.dotStyle}
          onChange={sd("dotStyle")}
          columns={3}
        />

        <div className="mt-5">
          <Label hint="위치 검출 패턴">Eye 스타일</Label>
          <Seg
            options={[
              { value: "square", label: "각짐" },
              { value: "rounded", label: "둥근" },
              { value: "circle", label: "원형" },
              { value: "leaf", label: "잎사귀" },
            ]}
            value={design.eyeStyle}
            onChange={sd("eyeStyle")}
            columns={4}
          />
        </div>

        <div className="mt-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Check checked={!design.eyeOuterAuto} onChange={(v) => sd("eyeOuterAuto")(!v)}>
              Eye 프레임 색상 지정
            </Check>
            <ColorField
              value={design.eyeOuterColor}
              onChange={sd("eyeOuterColor")}
              disabled={design.eyeOuterAuto}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Check checked={!design.eyeInnerAuto} onChange={(v) => sd("eyeInnerAuto")(!v)}>
              Eye 중심 색상 지정
            </Check>
            <ColorField
              value={design.eyeInnerColor}
              onChange={sd("eyeInnerColor")}
              disabled={design.eyeInnerAuto}
            />
          </div>
        </div>
      </Card>
    </>
  );
}
