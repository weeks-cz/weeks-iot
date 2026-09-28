import "server-only";
import path from "node:path";
import { Document, Font, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { formatCertificateDate, type CertificateData } from "./document";

/**
 * Certifikát jako PDF.
 *
 * PDF, ne HTML: chodí rodiči v příloze a má se dát vytisknout a pověsit
 * na zeď, aniž by záleželo na prohlížeči. Písmo je vložené (Bricolage
 * Grotesque, OFL — licence ve `fonts/OFL.txt`), jinak by čeština závisela
 * na tom, co má čtečka PDF po ruce.
 *
 * Soubory písma se čtou z disku. Na Vercelu je do funkce přibalí
 * `outputFileTracingIncludes` v `next.config.ts` — bez něj by lokálně
 * všechno fungovalo a v provozu PDF spadlo.
 *
 * Záměrně na něm není: jména zakladatelů, číslo certifikátu, QR kód.
 * Certifikát potvrzuje, co dítě udělalo, ne kdo ho podepsal.
 */

const FONT_DIR = path.join(process.cwd(), "src/features/certificates/fonts");

let fontsReady = false;
function registerFonts() {
  if (fontsReady) return;
  Font.register({
    family: "Bricolage",
    fonts: [
      { src: path.join(FONT_DIR, "bricolage-grotesque-500.ttf"), fontWeight: 500 },
      { src: path.join(FONT_DIR, "bricolage-grotesque-700.ttf"), fontWeight: 700 },
    ],
  });
  /* Výchozí dělení slov je anglické a češtinu láme na nesmyslných místech. */
  Font.registerHyphenationCallback((word) => [word]);
  fontsReady = true;
}

const INK = "#0c0e1a";
const INK_500 = "#4a4f6a";
const INK_300 = "#9da2bc";
const PAPER = "#fafaf7";
const PRIMARY = "#4f46e5";
const PRIMARY_GHOST = "#eceffd";
const CTA = "#f59e0b";

const s = StyleSheet.create({
  page: {
    backgroundColor: PAPER,
    fontFamily: "Bricolage",
    fontWeight: 500,
    color: INK,
    padding: 56,
    position: "relative",
  },
  ghost: {
    position: "absolute",
    right: -150,
    top: -150,
    fontSize: 720,
    fontWeight: 700,
    color: PRIMARY_GHOST,
  },
  brand: { flexDirection: "row", alignItems: "baseline" },
  brandName: { fontSize: 22, fontWeight: 700 },
  brandSub: { fontSize: 11, color: PRIMARY, marginLeft: 8, letterSpacing: 2 },
  body: { flexGrow: 1, justifyContent: "center" },
  kicker: { fontSize: 16, color: PRIMARY, fontWeight: 700, marginBottom: 10 },
  name: { fontWeight: 700, lineHeight: 1.05, marginBottom: 16 },
  lead: { fontSize: 15, color: INK_500 },
  course: { fontSize: 24, fontWeight: 700, marginTop: 4 },
  row: { flexDirection: "row", marginTop: 34 },
  colProject: { width: 220, paddingRight: 24 },
  colSkills: { flexGrow: 1, flexShrink: 1 },
  label: { fontSize: 10, color: INK_300, letterSpacing: 1, marginBottom: 6 },
  project: { fontSize: 16, fontWeight: 700 },
  skill: { flexDirection: "row", marginBottom: 5 },
  bullet: { width: 5, height: 5, backgroundColor: CTA, marginTop: 5, marginRight: 8 },
  skillText: { fontSize: 11.5, color: INK, flexShrink: 1 },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderTopWidth: 1,
    borderTopColor: INK,
    paddingTop: 12,
  },
  date: { fontSize: 11, color: INK_500 },
  sign: { alignItems: "flex-end" },
  signName: { fontSize: 13, fontWeight: 700 },
  signWeb: { fontSize: 11, color: PRIMARY },
});

function CertificateDocument({ data }: { data: CertificateData }) {
  /* Přezdívka má do 24 znaků, jméno od rodiče do 48 — delší se zmenší,
     aby zůstalo na jednom řádku. */
  const nameSize = data.name.length > 30 ? 40 : data.name.length > 18 ? 52 : 64;

  return (
    <Document title={`Certifikát — ${data.courseTitle}`} author="Weeks s.r.o." language="cs">
      <Page size="A4" orientation="landscape" style={s.page}>
        <Text style={s.ghost} fixed>
          W
        </Text>

        <View style={s.brand}>
          <Text style={s.brandName}>Weeks</Text>
          <Text style={s.brandSub}>UČEBNA</Text>
        </View>

        <View style={s.body}>
          <Text style={s.kicker}>Certifikát</Text>
          <Text style={[s.name, { fontSize: nameSize }]}>{data.name}</Text>
          <Text style={s.lead}>za dokončení kurzu</Text>
          <Text style={s.course}>{data.courseTitle}</Text>

          <View style={s.row}>
            <View style={s.colProject}>
              <Text style={s.label}>ZÁVĚREČNÝ PROJEKT</Text>
              <Text style={s.project}>{data.projectTitle}</Text>
            </View>
            <View style={s.colSkills}>
              <Text style={s.label}>CO ZVLÁDÁ</Text>
              {data.skills.map((skill) => (
                <View key={skill} style={s.skill}>
                  <View style={s.bullet} />
                  <Text style={s.skillText}>{skill}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={s.footer}>
          <Text style={s.date}>Dokončeno {formatCertificateDate(data.completedAt)}</Text>
          <View style={s.sign}>
            <Text style={s.signName}>Weeks s.r.o.</Text>
            <Text style={s.signWeb}>weeks.cz</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export async function renderCertificatePdf(data: CertificateData): Promise<Buffer> {
  registerFonts();
  return renderToBuffer(<CertificateDocument data={data} />);
}
