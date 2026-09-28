/**
 * Co se na certifikát tiskne. Sdílí to PDF, náhled v účtu i e-mail, aby
 * se tři místa nemohla rozejít v tom, co dítě „umí".
 */

export interface CertificateData {
  /** Přezdívka profilu, nebo jméno, které rodič napsal před stažením. */
  name: string;
  courseTitle: string;
  projectTitle: string;
  skills: string[];
  /** ISO čas posledního dokončení. */
  completedAt: string;
}

/** Nejdelší jméno, které se na certifikát vejde bez zalomení. */
export const MAX_CERTIFICATE_NAME = 48;

/**
 * Jméno napsané rodičem. Nic se neukládá — jde jen do jednoho PDF.
 * Prázdné nebo nesmyslné → null a použije se přezdívka.
 */
export function cleanCertificateName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.replace(/\s+/g, " ").trim();
  if (!name || name.length > MAX_CERTIFICATE_NAME) return null;
  /* Řídicí znaky by v PDF vykreslily čtverečky. */
  if (/[\u0000-\u001f\u007f]/.test(name)) return null;
  return name;
}

/** „5. října 2026" — v pražském čase, ať půlnoc UTC neposune den. */
export function formatCertificateDate(iso: string): string {
  return new Intl.DateTimeFormat("cs-CZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Prague",
  }).format(new Date(iso));
}

/** Název souboru bez diakritiky a mezer — přežije každý e-mailový klient. */
export function certificateFileName(courseSlug: string, name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `certifikat-weeks-${courseSlug}${slug ? `-${slug}` : ""}.pdf`;
}
