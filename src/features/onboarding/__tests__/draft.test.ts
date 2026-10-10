import { describe, expect, it } from "vitest";
import { EMPTY_DRAFT, parseDraft, serializeDraft } from "../draft";

const draft = { birthDate: "2014-06-15", nick: "Kuba", avatar: "robot", region: "CZ-PR" };

describe("serializeDraft / parseDraft", () => {
  it("cyklus projde beze změny", () => {
    expect(parseDraft(serializeDraft(draft))).toEqual(draft);
  });

  it("souhlasy se neukládají ani když je volající předá", () => {
    const withConsents = { ...draft, acceptTerms: true, parentalConsent: true, selfConsent: true } as never;
    const saved = JSON.parse(serializeDraft(withConsents));
    expect(Object.keys(saved).sort()).toEqual(["avatar", "birthDate", "nick", "region"]);
  });

  it("prázdný koncept je platný (počáteční stav)", () => {
    expect(parseDraft(serializeDraft(EMPTY_DRAFT))).toEqual(EMPTY_DRAFT);
  });

  it("poškozený nebo cizí obsah se zahodí celý", () => {
    expect(parseDraft(null)).toBeNull();
    expect(parseDraft("")).toBeNull();
    expect(parseDraft("{nope")).toBeNull();
    expect(parseDraft("[]")).toBeNull();
    expect(parseDraft('"text"')).toBeNull();
    expect(parseDraft(JSON.stringify({ ...draft, nick: 42 }))).toBeNull();
    expect(parseDraft(JSON.stringify({ ...draft, birthDate: "15.6.2014" }))).toBeNull();
    expect(parseDraft(JSON.stringify({ ...draft, avatar: "<script>" }))).toBeNull();
    expect(parseDraft(JSON.stringify({ ...draft, region: "cz pr" }))).toBeNull();
  });

  it("přezdívka delší než 24 znaků se nepřijme", () => {
    expect(parseDraft(JSON.stringify({ ...draft, nick: "x".repeat(25) }))).toBeNull();
  });

  it("příliš velký záznam se nerozbaluje", () => {
    expect(parseDraft("x".repeat(2_001))).toBeNull();
  });
});
