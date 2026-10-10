import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Smazání účtu nesmí strhnout ledger souhlasů — text na /ochrana-udaju
 * a bod 6 souhlasu zákonného zástupce slibují opak. Ochranu drží migrace
 * (FK `on delete set null`), ne kód, takže test čte migraci jako text.
 */
const migrations = ["013_ucebna_consent_survives_deletion.sql"].map((f) =>
  readFileSync(join(process.cwd(), "supabase/migrations", f), "utf8"),
);
const sql = migrations.join("\n").replace(/--[^\n]*/g, "");

describe("ledger souhlasů přežije smazání účtu", () => {
  it("parent_id je nullable", () => {
    expect(sql).toMatch(/alter column parent_id drop not null/);
  });

  it("cizí klíč na parents se mění z cascade na set null", () => {
    expect(sql).toMatch(/drop constraint consents_parent_id_fkey/);
    expect(sql).toMatch(
      /foreign key \(parent_id\) references public\.parents\(id\) on delete set null/,
    );
    expect(sql).not.toMatch(/on delete cascade/);
  });
});

describe("kód mazání účtu", () => {
  const actions = readFileSync(
    join(process.cwd(), "src/features/consent/actions.ts"),
    "utf8",
  );

  it("nemaže řádky ledgeru ručně", () => {
    expect(actions).not.toMatch(/from\("consents"\)\s*\.delete/);
  });
});
