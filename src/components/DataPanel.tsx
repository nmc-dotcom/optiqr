import { Card, Check, Label, Seg, TextInput } from "./ui";
import { C, MONO } from "../lib/brand";
import type { DataType, Fields } from "../lib/qr/types";

const TYPES = [
  { value: "url", label: "URL" },
  { value: "text", label: "텍스트" },
  { value: "email", label: "이메일" },
  { value: "tel", label: "전화" },
  { value: "sms", label: "SMS" },
  { value: "wifi", label: "WiFi" },
  { value: "vcard", label: "명함" },
  { value: "geo", label: "위치" },
];

export function DataPanel({
  type,
  setType,
  d,
  set,
  payload,
}: {
  type: DataType;
  setType: (t: DataType) => void;
  d: Fields;
  set: (k: keyof Fields) => (v: any) => void;
  payload: string;
}) {
  return (
    <Card>
      <Label>데이터 종류</Label>
      <Seg options={TYPES} value={type} onChange={setType} columns={4} />

      <div className="mt-5 space-y-4">
        {type === "url" && (
          <div>
            <Label hint="스킴을 생략하면 https:// 를 붙입니다">주소</Label>
            <TextInput value={d.url} onChange={set("url")} placeholder="holorado.me" mono />
          </div>
        )}

        {type === "text" && (
          <div>
            <Label hint={`${(d.text || "").length}자`}>텍스트</Label>
            <TextInput value={d.text} onChange={set("text")} multiline rows={5} placeholder="QR에 담을 문구" />
          </div>
        )}

        {type === "email" && (
          <>
            <div>
              <Label>받는 사람</Label>
              <TextInput value={d.emailTo} onChange={set("emailTo")} placeholder="hello@holorado.me" mono />
            </div>
            <div>
              <Label>제목</Label>
              <TextInput value={d.emailSubject} onChange={set("emailSubject")} placeholder="문의드립니다" />
            </div>
            <div>
              <Label>본문</Label>
              <TextInput value={d.emailBody} onChange={set("emailBody")} multiline />
            </div>
          </>
        )}

        {type === "tel" && (
          <div>
            <Label hint="국가번호 포함 권장">전화번호</Label>
            <TextInput value={d.tel} onChange={set("tel")} placeholder="+821012345678" mono />
          </div>
        )}

        {type === "sms" && (
          <>
            <div>
              <Label>받는 번호</Label>
              <TextInput value={d.smsTo} onChange={set("smsTo")} placeholder="+821012345678" mono />
            </div>
            <div>
              <Label>메시지</Label>
              <TextInput value={d.smsBody} onChange={set("smsBody")} multiline rows={2} />
            </div>
          </>
        )}

        {type === "wifi" && (
          <>
            <div>
              <Label>네트워크 이름 (SSID)</Label>
              <TextInput value={d.wifiSsid} onChange={set("wifiSsid")} placeholder="HOLORADO-5G" mono />
            </div>
            <div>
              <Label>보안 방식</Label>
              <Seg
                options={[
                  { value: "WPA", label: "WPA/WPA2" },
                  { value: "WEP", label: "WEP" },
                  { value: "nopass", label: "없음" },
                ]}
                value={d.wifiAuth}
                onChange={set("wifiAuth")}
              />
            </div>
            {d.wifiAuth !== "nopass" && (
              <div>
                <Label>비밀번호</Label>
                <TextInput value={d.wifiPass} onChange={set("wifiPass")} mono />
              </div>
            )}
            <Check checked={d.wifiHidden} onChange={set("wifiHidden")}>
              숨겨진 네트워크
            </Check>
            <p className="text-xs" style={{ color: C.inkSoft }}>
              비밀번호는 QR 안에 평문으로 들어갑니다. 외부에 붙이는 용도라면 게스트 네트워크를 쓰세요.
            </p>
          </>
        )}

        {type === "vcard" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>이름</Label>
                <TextInput value={d.vcFirst} onChange={set("vcFirst")} placeholder="길동" />
              </div>
              <div>
                <Label>성</Label>
                <TextInput value={d.vcLast} onChange={set("vcLast")} placeholder="홍" />
              </div>
              <div>
                <Label>회사</Label>
                <TextInput value={d.vcOrg} onChange={set("vcOrg")} />
              </div>
              <div>
                <Label>직함</Label>
                <TextInput value={d.vcTitle} onChange={set("vcTitle")} />
              </div>
              <div>
                <Label>휴대전화</Label>
                <TextInput value={d.vcTel} onChange={set("vcTel")} mono />
              </div>
              <div>
                <Label>사무실</Label>
                <TextInput value={d.vcTel2} onChange={set("vcTel2")} mono />
              </div>
              <div>
                <Label>이메일</Label>
                <TextInput value={d.vcEmail} onChange={set("vcEmail")} mono />
              </div>
              <div>
                <Label>웹사이트</Label>
                <TextInput value={d.vcUrl} onChange={set("vcUrl")} mono />
              </div>
            </div>
            <div>
              <Label>주소</Label>
              <TextInput value={d.vcAddr} onChange={set("vcAddr")} />
            </div>
            <div>
              <Label>메모</Label>
              <TextInput value={d.vcNote} onChange={set("vcNote")} multiline rows={2} />
            </div>
          </>
        )}

        {type === "geo" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>위도</Label>
              <TextInput value={d.geoLat} onChange={set("geoLat")} placeholder="37.5665" mono />
            </div>
            <div>
              <Label>경도</Label>
              <TextInput value={d.geoLng} onChange={set("geoLng")} placeholder="126.9780" mono />
            </div>
          </div>
        )}
      </div>

      {payload && (
        <div className="mt-5">
          <Label hint={`${new TextEncoder().encode(payload).length} bytes`}>인코딩 결과</Label>
          <pre
            className="max-h-28 overflow-auto whitespace-pre-wrap break-all rounded p-3 text-xs"
            style={{ background: C.cream, border: `1px solid ${C.line}`, color: C.inkSoft, fontFamily: MONO }}
          >
            {payload}
          </pre>
        </div>
      )}
    </Card>
  );
}
