import { describe, expect, it } from "vitest";
import { renderEmail, renderEmailText } from "@/lib/email/layout";
import { CONSENT_TEXTS, DEVICE_LINK_MARKETING_TEXT, consentTextsForAge } from "@/features/consent/texts";
import { deviceLinkEmail, deviceLinkReminderEmail } from "../emails";

const LESSON = "https://ucebna.weeks.cz/kurz/iot/rozsvit-ledku/?odkaz=abc";
const UNSUB = "https://ucebna.weeks.cz/odhlasit?t=xyz&a=1";

function allText(t: ReturnType<typeof deviceLinkEmail>): string {
  const c = t.content;
  return [t.subject, c.preheader, c.heading, ...c.paragraphs, c.button?.label, c.footnote, c.secondaryLink?.label]
    .filter(Boolean)
    .join("\n");
}

describe("deviceLinkEmail", () => {
  it("má předmět a tlačítko ze zadání", () => {
    const t = deviceLinkEmail({ lessonUrl: LESSON, unsubscribeUrl: null });
    expect(t.subject).toBe("Odkaz na Učebnu Weeks pro vaše dítě");
    expect(t.content.button).toEqual({ label: "Otevřít učebnu", url: LESSON });
  });

  it("nemá vykřičník ani zakázané formulace", () => {
    for (const unsub of [null, UNSUB]) {
      const text = allText(deviceLinkEmail({ lessonUrl: LESSON, unsubscribeUrl: unsub }));
      expect(text).not.toContain("!");
      expect(text).not.toMatch(/uvidíte/i);
      expect(text).not.toMatch(/postup dítěte/i);
    }
  });

  it("drží číslo s jednotkou nezlomitelnou mezerou", () => {
    const text = allText(deviceLinkEmail({ lessonUrl: LESSON, unsubscribeUrl: null }));
    expect(text).toContain("20\u00a0minut");
  });

  it("odkaz na odhlášení je jen když je předaný", () => {
    const bez = deviceLinkEmail({ lessonUrl: LESSON, unsubscribeUrl: null });
    expect(bez.content.secondaryLink).toBeUndefined();
    expect(renderEmail(bez.content)).not.toContain(UNSUB);

    const s = deviceLinkEmail({ lessonUrl: LESSON, unsubscribeUrl: UNSUB });
    expect(s.content.secondaryLink).toEqual({ label: "Nechci další e-maily", url: UNSUB });
    expect(renderEmail(s.content)).toContain("Nechci další e-maily");
    expect(renderEmailText(s.content)).toContain(UNSUB);
  });
});

describe("deviceLinkReminderEmail", () => {
  it("má předmět, tlačítko a odhlášení", () => {
    const t = deviceLinkReminderEmail({ lessonUrl: LESSON, unsubscribeUrl: UNSUB });
    expect(t.subject).toBe("Dítě se k učebně ještě nedostalo?");
    expect(t.content.button).toEqual({ label: "Otevřít učebnu", url: LESSON });
    expect(t.content.secondaryLink?.url).toBe(UNSUB);
    expect(allText(t)).not.toContain("!");
    expect(allText(t)).not.toMatch(/uvidíte|postup dítěte/i);
  });

  it("netvrdí, že odkaz nikdo neotevřel (otevření na telefonu nevidíme)", () => {
    const text = allText(deviceLinkReminderEmail({ lessonUrl: LESSON, unsubscribeUrl: UNSUB }));
    expect(text).not.toMatch(/nikdo|neotevřel/i);
    expect(text).toContain("Pokud se k\u00a0ní dítě ještě nedostalo, tady je odkaz znovu.");
    expect(text).toMatch(/jediná připomínka/);
  });

  it("nezlomitelné mezery: číslo s jednotkou a jednopísmenná slova", () => {
    const text = allText(deviceLinkReminderEmail({ lessonUrl: LESSON, unsubscribeUrl: UNSUB }));
    expect(text).toContain("20\u00a0minut");
    expect(text).toContain("a\u00a0jde otevřít");
    expect(text).toContain("a\u00a0prohlížeč");
  });
});

describe("nezlomitelné mezery v e-mailu s odkazem", () => {
  it("s myší, v prohlížeči, 20 minut", () => {
    const text = allText(deviceLinkEmail({ lessonUrl: LESSON, unsubscribeUrl: null }));
    expect(text).toContain("s\u00a0myší");
    expect(text).toContain("v\u00a0prohlížeči");
    expect(text).toContain("20\u00a0minut");
    expect(text).toContain("a\u00a0získalo");
  });
});

describe("secondaryLink v layoutu", () => {
  it("escapuje popisek i URL v HTML", () => {
    const html = renderEmail({
      preheader: "p",
      heading: "h",
      paragraphs: [],
      secondaryLink: { label: "<b>x</b>", url: 'https://a.cz/?a=1&b="2"' },
    });
    expect(html).not.toContain("<b>x</b>");
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(html).toContain("a=1&amp;b=&quot;2&quot;");
  });
});

describe("DEVICE_LINK_MARKETING_TEXT", () => {
  it("má verzi a druh ze zadání a není povinný", () => {
    expect(DEVICE_LINK_MARKETING_TEXT.kind).toBe("marketing");
    expect(DEVICE_LINK_MARKETING_TEXT.version).toBe("marketing-odkaz-v1");
    expect(DEVICE_LINK_MARKETING_TEXT.required).toBe(false);
  });

  it("zmiňuje předání hashe do Meta", () => {
    expect(DEVICE_LINK_MARKETING_TEXT.full).toMatch(/Meta Platforms Ireland/);
    expect(DEVICE_LINK_MARKETING_TEXT.full).toMatch(/hash/);
  });

  it("není v CONSENT_TEXTS a počet pro věk se nezměnil", () => {
    expect(CONSENT_TEXTS).not.toContain(DEVICE_LINK_MARKETING_TEXT);
    expect(CONSENT_TEXTS.map((t) => t.version)).not.toContain("marketing-odkaz-v1");
    expect(consentTextsForAge(true)).toHaveLength(3);
    expect(consentTextsForAge(false)).toHaveLength(3);
  });
});
