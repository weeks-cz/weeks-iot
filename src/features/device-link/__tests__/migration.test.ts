import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Tabulka žádostí o odkaz na počítač je čistě serverová: ochranu drží
 * migrace (RLS bez politik, žádný grant pro klientské role), ne kód. Test
 * proto čte migraci jako text.
 */
const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/015_ucebna_odkaz_na_pc.sql"),
  "utf8",
)
  .replace(/--[^\n]*/g, "")
  // Zarovnání a zalomení řádků v SQL nesmí rozhodovat o výsledku.
  .replace(/\s+/g, " ");

describe("migrace 015 – device_link_requests", () => {
  it("vytvoří tabulku a zapne RLS", () => {
    expect(sql).toMatch(/create table public\.device_link_requests/);
    expect(sql).toMatch(
      /alter table public\.device_link_requests enable row level security/,
    );
  });

  it("e-mail je nullable a chybět smí jen u anonymizovaného řádku", () => {
    expect(sql).toMatch(/email citext,/);
    expect(sql).not.toMatch(/email citext not null/);
    expect(sql).toMatch(
      /check \(\(email is not null\) or \(anonymized_at is not null\)\)/,
    );
  });

  it("klientským rolím nedává žádný grant", () => {
    expect(sql).not.toMatch(/grant[^;]*device_link_requests[^;]*to (anon|authenticated)/);
    expect(sql).not.toMatch(/grant[^;]*to (anon|authenticated)/);
  });

  it("má sloupce pro původ návštěvy, souhlas a životní cyklus", () => {
    for (const col of [
      "utm_source text",
      "utm_medium text",
      "utm_campaign text",
      "utm_content text",
      "utm_term text",
      "referrer text",
      "env text",
      "marketing_consent boolean not null default false",
      "sent_at timestamptz",
      "send_error text",
      "verified_at timestamptz",
      "opened_at timestamptz",
      "reminder_sent_at timestamptz",
      "unsubscribed_at timestamptz",
      "anonymized_at timestamptz",
      "created_at timestamptz not null default now()",
    ]) {
      expect(sql).toContain(col);
    }
  });

  it("nemá anon_id", () => {
    expect(sql).not.toMatch(/anon_id/);
  });

  it("indexuje e-mail pro rate limit a vyhledání", () => {
    expect(sql).toMatch(
      /create index[^;]*on public\.device_link_requests \(lower\(email::text\), created_at desc\)/,
    );
  });

  it("ledger souhlasů se váže na žádost a přežije její smazání", () => {
    expect(sql).toMatch(
      /add column device_link_request_id uuid references public\.device_link_requests\(id\) on delete set null/,
    );
  });
});
