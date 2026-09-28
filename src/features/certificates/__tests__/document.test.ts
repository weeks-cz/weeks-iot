import { describe, expect, it } from "vitest";
import {
  certificateFileName,
  cleanCertificateName,
  formatCertificateDate,
  MAX_CERTIFICATE_NAME,
} from "../document";

describe("cleanCertificateName", () => {
  it("srovná mezery a ořízne okraje", () => {
    expect(cleanCertificateName("  Jan   Novák ")).toBe("Jan Novák");
  });

  it("prázdné, příliš dlouhé nebo cizí typy → přezdívka", () => {
    expect(cleanCertificateName("")).toBeNull();
    expect(cleanCertificateName("   ")).toBeNull();
    expect(cleanCertificateName("a".repeat(MAX_CERTIFICATE_NAME + 1))).toBeNull();
    expect(cleanCertificateName(undefined)).toBeNull();
    expect(cleanCertificateName(42)).toBeNull();
  });

  it("odmítne řídicí znaky", () => {
    expect(cleanCertificateName("Jan\u0000Novák")).toBeNull();
  });
});

describe("formatCertificateDate", () => {
  it("česky a v pražském čase — pozdní večer UTC je už další den", () => {
    expect(formatCertificateDate("2026-10-04T22:30:00Z")).toBe("5. října 2026");
  });
});

describe("certificateFileName", () => {
  it("bez diakritiky a mezer", () => {
    expect(certificateFileName("iot", "Šárka Říhová")).toBe("certifikat-weeks-iot-sarka-rihova.pdf");
  });

  it("jméno ze samých symbolů nenechá v názvu prázdnou pomlčku", () => {
    expect(certificateFileName("iot", "🙂")).toBe("certifikat-weeks-iot.pdf");
  });
});
