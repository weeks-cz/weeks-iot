import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cleanCertificateName, certificateFileName } from "@/features/certificates/document";
import { renderCertificatePdf } from "@/features/certificates/pdf";
import { earnedCertificates } from "@/features/certificates/queries";

/**
 * Certifikát ke stažení z účtu.
 *
 * GET  — otevře PDF v prohlížeči, s přezdívkou profilu.
 * POST — stáhne PDF se jménem, které rodič napsal do formuláře.
 *
 * Jméno chodí POSTem, ne v adrese: v URL by skončilo v historii prohlížeče
 * a v logách serveru. A neukládá se nikam — jde jen do tohohle jednoho
 * PDF (tak to slibuje i popisek u pole).
 *
 * Vlastnictví profilu ověřuje RLS: běžný klient vidí jen děti přihlášeného
 * účtu, takže cizí id vrátí prázdno a skončí 404 — stejně jako id, které
 * neexistuje. Až potom přijde na řadu servisní dotaz na postup.
 */

type Params = { dite: string; kurz: string };

async function certificateResponse(
  params: Promise<Params>,
  rawName: unknown,
  disposition: "inline" | "attachment",
): Promise<Response> {
  const { dite, kurz } = await params;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new NextResponse("Nepřihlášeno", { status: 401 });

  const { data: child } = await supabase
    .from("children")
    .select("id, nick")
    .eq("id", dite)
    .is("archived_at", null)
    .maybeSingle();
  if (!child) return new NextResponse("Nenalezeno", { status: 404 });

  const cert = (await earnedCertificates(child.id, child.nick)).find((c) => c.courseSlug === kurz);
  if (!cert) return new NextResponse("Certifikát zatím není", { status: 404 });

  const name = cleanCertificateName(rawName) ?? child.nick;
  const pdf = await renderCertificatePdf({ ...cert.data, name });
  const file = certificateFileName(kurz, name);

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${file}"`,
      /* Se jménem dítěte — nesmí zůstat v žádné sdílené cache. */
      "Cache-Control": "private, no-store",
    },
  });
}

export async function GET(_req: Request, { params }: { params: Promise<Params> }) {
  return certificateResponse(params, null, "inline");
}

export async function POST(req: Request, { params }: { params: Promise<Params> }) {
  const form = await req.formData().catch(() => null);
  return certificateResponse(params, form?.get("jmeno"), "attachment");
}
