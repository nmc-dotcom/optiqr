import type { DataType, Fields } from "./types";

const wifiEsc = (s: string) => (s || "").replace(/([\\;,:"])/g, "\\$1");
const vcEsc = (s: string) => (s || "").replace(/([\\;,])/g, "\\$1").replace(/\n/g, "\\n");

export function buildPayload(type: DataType, d: Fields): string {
  switch (type) {
    case "url": {
      const u = (d.url || "").trim();
      if (!u) return "";
      return /^[a-zA-Z][a-zA-Z0-9+.\-]*:/.test(u) ? u : "https://" + u;
    }
    case "text":
      return d.text || "";
    case "email": {
      if (!d.emailTo) return "";
      const q = [];
      if (d.emailSubject) q.push("subject=" + encodeURIComponent(d.emailSubject));
      if (d.emailBody) q.push("body=" + encodeURIComponent(d.emailBody));
      return `mailto:${d.emailTo}${q.length ? "?" + q.join("&") : ""}`;
    }
    case "tel": {
      const n = (d.tel || "").replace(/[^\d+]/g, "");
      return n ? `tel:${n}` : "";
    }
    case "sms": {
      const n = (d.smsTo || "").replace(/[^\d+]/g, "");
      return n ? `SMSTO:${n}:${d.smsBody || ""}` : "";
    }
    case "wifi": {
      if (!d.wifiSsid) return "";
      const t = d.wifiAuth === "nopass" ? "nopass" : d.wifiAuth;
      return `WIFI:T:${t};S:${wifiEsc(d.wifiSsid)};${
        t === "nopass" ? "" : `P:${wifiEsc(d.wifiPass)};`
      }${d.wifiHidden ? "H:true;" : ""};`;
    }
    case "vcard": {
      if (!d.vcFirst && !d.vcLast && !d.vcOrg) return "";
      const L: string[] = ["BEGIN:VCARD", "VERSION:3.0"];
      L.push(`N:${vcEsc(d.vcLast)};${vcEsc(d.vcFirst)};;;`);
      L.push(`FN:${vcEsc([d.vcFirst, d.vcLast].filter(Boolean).join(" "))}`);
      if (d.vcOrg) L.push(`ORG:${vcEsc(d.vcOrg)}`);
      if (d.vcTitle) L.push(`TITLE:${vcEsc(d.vcTitle)}`);
      if (d.vcTel) L.push(`TEL;TYPE=CELL:${d.vcTel}`);
      if (d.vcTel2) L.push(`TEL;TYPE=WORK:${d.vcTel2}`);
      if (d.vcEmail) L.push(`EMAIL;TYPE=INTERNET:${d.vcEmail}`);
      if (d.vcUrl) L.push(`URL:${d.vcUrl}`);
      if (d.vcAddr) L.push(`ADR;TYPE=WORK:;;${vcEsc(d.vcAddr)};;;;`);
      if (d.vcNote) L.push(`NOTE:${vcEsc(d.vcNote)}`);
      L.push("END:VCARD");
      return L.join("\n");
    }
    case "geo": {
      if (!d.geoLat || !d.geoLng) return "";
      return `geo:${d.geoLat},${d.geoLng}`;
    }
    default:
      return "";
  }
}
