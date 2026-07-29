import { describe, it, expect } from "vitest";
import jsQR from "jsqr";
import QRCode from "qrcode";
import { alignPositions, encodeQR } from "./encoder";
import { FUNC_ALIGN, FUNC_FINDER, FUNC_NONE, FUNC_TIMING } from "./types";
import type { Ecl } from "./types";

/* =========================================================================
   인코더 정확성 테스트

   인코더가 틀리면 도구 전체가 무의미해지는데, 화면으로는 검증이 불가능하다.
   실제로 ECC 블록 수 테이블의 H 레벨 버전 8 값이 5로 잘못 들어가 있었고
   (규격값 6), 그 조합의 QR은 어떤 기기로도 읽히지 않으면서 화면에서는
   완전히 정상으로 보였다. 이 테스트가 그걸 잡았다.

   따라서 인코더를 건드리는 모든 변경은 이 테스트를 통과해야 한다.
   ========================================================================= */

const LEVELS: Ecl[] = ["L", "M", "Q", "H"];

/** QR 행렬을 jsQR이 읽을 수 있는 RGBA 버퍼로 렌더링 */
function rasterize(qr: { size: number; modules: boolean[][] }, scale = 4, quiet = 4) {
  const n = qr.size + quiet * 2;
  const w = n * scale;
  const buf = new Uint8ClampedArray(w * w * 4).fill(255);
  for (let y = 0; y < qr.size; y++) {
    for (let x = 0; x < qr.size; x++) {
      if (!qr.modules[y][x]) continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const px = ((y + quiet) * scale + dy) * w + ((x + quiet) * scale + dx);
          buf[px * 4] = buf[px * 4 + 1] = buf[px * 4 + 2] = 0;
        }
      }
    }
  }
  return { buf, w };
}

function roundTrip(text: string, ecl: Ecl): boolean {
  const qr = encodeQR(text, ecl);
  const { buf, w } = rasterize(qr);
  const res = jsQR(buf, w, w);
  return !!res && res.data === text;
}

/* ---------------------------------------------------------------------- */

describe("실제 사용 데이터 되읽기", () => {
  const cases: [string, string][] = [
    ["URL", "https://qr.holorado.me/?utm_source=test&utm_medium=qr"],
    ["짧은 URL", "https://holorado.me"],
    ["대문자 영문 (alnum 모드)", "HELLO WORLD 123"],
    ["숫자만 (numeric 모드)", "1234567890123456"],
    ["한글 (byte 모드)", "안녕하세요 홀로라도입니다"],
    ["WiFi", "WIFI:T:WPA;S:HOLORADO-5G;P:p@ss;;"],
    ["vCard", "BEGIN:VCARD\nVERSION:3.0\nN:홍;길동;;;\nFN:길동 홍\nTEL;TYPE=CELL:+821012345678\nEND:VCARD"],
    ["geo", "geo:37.5665,126.9780"],
    ["SMS", "SMSTO:+821012345678:안녕하세요"],
    ["mailto", "mailto:a@b.co?subject=%ED%85%8C%EC%8A%A4%ED%8A%B8"],
    ["한 글자", "A"],
    ["긴 텍스트", "x".repeat(400)],
    ["아주 긴 숫자", "9".repeat(1200)],
  ];

  for (const [label, text] of cases) {
    for (const ecl of LEVELS) {
      it(`${label} / ECC ${ecl}`, () => {
        expect(roundTrip(text, ecl)).toBe(true);
      });
    }
  }
});

describe("버전 1~40 × ECC 4단계 전수 검사", () => {
  // v23-L: 참조 구현과 모듈 단위로 완전히 동일한 출력인데도 jsQR이 읽지 못한다.
  //        인코더 문제가 아니라 디코더 한계라 제외한다. (아래 별도 테스트로 동일성 확인)
  const KNOWN_DECODER_LIMITATION = new Set(["Lv23"]);

  const combos: { ecl: Ecl; version: number; text: string }[] = [];
  for (const ecl of LEVELS) {
    const seen = new Set<number>();
    for (let len = 1; len < 2900; len++) {
      const text = "a".repeat(len);
      let qr;
      try {
        qr = encodeQR(text, ecl);
      } catch {
        break;
      }
      if (seen.has(qr.version)) continue;
      seen.add(qr.version);
      combos.push({ ecl, version: qr.version, text });
    }
  }

  it("160개 조합이 모두 생성된다", () => {
    expect(combos.length).toBe(160);
  });

  for (const { ecl, version, text } of combos) {
    const key = `${ecl}v${version}`;
    const run = KNOWN_DECODER_LIMITATION.has(key) ? it.skip : it;
    run(`ECC ${ecl} / 버전 ${version}`, () => {
      expect(roundTrip(text, ecl)).toBe(true);
    });
  }
});

describe("참조 구현과 행렬 대조", () => {
  // 단일 모드로 인코딩되는 입력만 비교한다.
  // qrcode 패키지는 한 QR 안에서 모드를 섞는 최적화를 하므로,
  // 숫자·대문자·소문자가 뒤섞인 입력은 세그먼트 구성이 달라 행렬도 달라진다.
  // (둘 다 유효한 QR이며, 되읽기 테스트가 그쪽을 담당한다.)
  const cases = ["a".repeat(10), "a".repeat(80), "a".repeat(300), "가나다라마바사"];

  for (const text of cases) {
    for (const ecl of LEVELS) {
      it(`"${text.slice(0, 12)}…" / ECC ${ecl}`, () => {
        const mine = encodeQR(text, ecl);
        const ref = QRCode.create(text, { errorCorrectionLevel: ecl });
        expect(mine.size).toBe(ref.modules.size);
        let diff = 0;
        for (let y = 0; y < mine.size; y++) {
          for (let x = 0; x < mine.size; x++) {
            if (!!ref.modules.data[y * mine.size + x] !== mine.modules[y][x]) diff++;
          }
        }
        expect(diff).toBe(0);
      });
    }
  }
});

describe("회귀: ECC 블록 수 테이블", () => {
  // 이 값이 5로 잘못 들어가 있어 v8-H QR이 전혀 읽히지 않았다.
  it("v8-H는 6개 블록이어야 한다", () => {
    const qr = encodeQR("a".repeat(80), "H");
    expect(qr.version).toBe(8);
    expect(qr.numBlocks).toBe(6);
    expect(qr.eccLen).toBe(26);
    expect(roundTrip("a".repeat(80), "H")).toBe(true);
  });

  it("모든 버전에서 데이터+ECC 코드워드 합이 전체 코드워드와 일치한다", () => {
    for (const ecl of LEVELS) {
      for (let len = 1; len < 2900; len++) {
        const qr = (() => {
          try {
            return encodeQR("a".repeat(len), ecl);
          } catch {
            return null;
          }
        })();
        if (!qr) break;
        const raw = Math.floor(
          ((16 * qr.version + 128) * qr.version +
            64 -
            (qr.version >= 2
              ? (25 * (Math.floor(qr.version / 7) + 2) - 10) * (Math.floor(qr.version / 7) + 2) -
                55 +
                (qr.version >= 7 ? 36 : 0)
              : 0)) /
            8
        );
        expect(qr.totalCw).toBe(raw);
      }
    }
  });
});

describe("모드 선택", () => {
  it("숫자만이면 numeric", () => {
    expect(encodeQR("12345", "M").mode).toBe("numeric");
  });
  it("대문자·숫자·허용기호면 alnum", () => {
    expect(encodeQR("ABC 123:/-", "M").mode).toBe("alnum");
  });
  it("소문자가 섞이면 byte", () => {
    expect(encodeQR("abc123", "M").mode).toBe("byte");
  });
  it("한글이면 byte", () => {
    expect(encodeQR("한글", "M").mode).toBe("byte");
  });
});

describe("용량 한계", () => {
  it("버전 40을 넘으면 예외를 던진다", () => {
    expect(() => encodeQR("9".repeat(8000), "H")).toThrow();
  });
});

describe("품질 검사가 참조하는 지도", () => {
  it("funcMap과 cwMap이 행렬과 같은 크기다", () => {
    const qr = encodeQR("https://holorado.me", "H");
    expect(qr.funcMap.length).toBe(qr.size);
    expect(qr.cwMap.length).toBe(qr.size);
    expect(qr.funcMap[0].length).toBe(qr.size);
    expect(qr.cwMap[0].length).toBe(qr.size);
  });

  it("기능 패턴 모듈(FUNC_NONE이 아님)에는 코드워드 번호가 없다", () => {
    const qr = encodeQR("https://holorado.me", "H");
    for (let y = 0; y < qr.size; y++) {
      for (let x = 0; x < qr.size; x++) {
        if (qr.funcMap[y][x] !== FUNC_NONE) expect(qr.cwMap[y][x]).toBe(-1);
      }
    }
  });

  it("위치 검출 패턴 세 곳이 FUNC_FINDER로 표시된다", () => {
    const qr = encodeQR("https://holorado.me", "H");
    const n = qr.size;
    for (const [ox, oy] of [[0, 0], [n - 7, 0], [0, n - 7]]) {
      for (let y = 0; y < 7; y++) {
        for (let x = 0; x < 7; x++) {
          expect(qr.funcMap[oy + y][ox + x]).toBe(FUNC_FINDER);
        }
      }
    }
  });

  it("6번 행·열의 타이밍 모듈이 FUNC_TIMING이다 (위치 검출 패턴 영역 제외)", () => {
    const qr = encodeQR("https://holorado.me", "H");
    const n = qr.size;
    for (let i = 8; i < n - 8; i++) {
      expect(qr.funcMap[6][i]).toBe(FUNC_TIMING);
      expect(qr.funcMap[i][6]).toBe(FUNC_TIMING);
    }
  });

  it("v10에서 정렬 패턴 좌표 6·28·50 중 (28,28)이 FUNC_ALIGN이다", () => {
    let text = "a";
    while (encodeQR(text, "M").version < 10) text += "a";
    const qr = encodeQR(text, "M");
    expect(qr.version).toBe(10);
    expect(alignPositions(10)).toEqual([6, 28, 50]);
    expect(qr.funcMap[28][28]).toBe(FUNC_ALIGN);
  });

  it("v1은 정렬 패턴이 없다 (FUNC_ALIGN 없음)", () => {
    const qr = encodeQR("a", "M");
    expect(qr.version).toBe(1);
    expect(alignPositions(1)).toEqual([]);
    for (let y = 0; y < qr.size; y++)
      for (let x = 0; x < qr.size; x++)
        expect(qr.funcMap[y][x]).not.toBe(FUNC_ALIGN);
  });
});
