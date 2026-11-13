import { describe, expect, it } from "vitest";
import { browserEnvironment } from "../environment";

/* Vzorky user agentů ve tvaru, jaký vestavěné prohlížeče posílají. Skutečné
   řetězce se mění s každou verzí aplikace — rozhoduje jen značka, a ta se
   ověří průchodem na telefonu (pro-lukase/pruchod-telefon.md). */
const UA = {
  chromeAndroid:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
  safariIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
  facebookIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/490.0.0.40.107;FBBV/123;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/18.1;FBSS/3;FBCR/;FBID/phone;FBLC/cs_CZ;FBOP/80]",
  facebookAndroid:
    "Mozilla/5.0 (Linux; Android 14; SM-S911B Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/490.0.0.40.107;]",
  instagramIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 355.0.0.20.108 (iPhone15,2; iOS 18_1; cs_CZ; cs; scale=3.00; 1179x2556; 654321)",
  /* Instagram na Androidu nese i značku Facebooku — musí vyhrát Instagram. */
  instagramAndroid:
    "Mozilla/5.0 (Linux; Android 14; SM-S911B Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/490.0.0.40.107;] Instagram 355.0.0.20.108 Android (34/14; 480dpi; 1080x2340; samsung; SM-S911B; dm1q; qcom; cs_CZ; 654321)",
  messengerIos:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/480.0.0.40.100;]",
};

describe("browserEnvironment", () => {
  it("běžný prohlížeč", () => {
    expect(browserEnvironment(UA.chromeAndroid)).toBe("browser");
    expect(browserEnvironment(UA.safariIos)).toBe("browser");
  });

  it("vestavěný prohlížeč Facebooku na iOS i Androidu", () => {
    expect(browserEnvironment(UA.facebookIos)).toBe("facebook");
    expect(browserEnvironment(UA.facebookAndroid)).toBe("facebook");
  });

  it("Instagram vyhrává, i když nese značky Facebooku", () => {
    expect(browserEnvironment(UA.instagramIos)).toBe("instagram");
    expect(browserEnvironment(UA.instagramAndroid)).toBe("instagram");
  });

  it("Messenger patří k Facebooku", () => {
    expect(browserEnvironment(UA.messengerIos)).toBe("facebook");
  });

  it("chybějící user agent je běžný prohlížeč", () => {
    expect(browserEnvironment(null)).toBe("browser");
    expect(browserEnvironment(undefined)).toBe("browser");
    expect(browserEnvironment("")).toBe("browser");
  });

  it("vrací jen jednu ze tří hodnot, nikdy kus user agentu", () => {
    for (const ua of Object.values(UA)) {
      expect(["browser", "facebook", "instagram"]).toContain(browserEnvironment(ua));
    }
  });
});
