import { CONTROLLER, SITE } from "@/lib/site";

/**
 * Základ e-mailové šablony.
 *
 * E-mailové klienty jsou zaseklé někde u HTML 4: žádný flexbox, žádný grid,
 * u Outlooku ani pořádný `<style>` v hlavičce. Proto tabulkové rozvržení
 * a inline styly — vypadá to jako krok zpět, ale je to jediné, co spolehlivě
 * projde Gmailem, Seznamem i Outlookem zároveň.
 *
 * Písma jsou systémová schválně: webfont si stejně většina klientů
 * nenačte a fallback by pak vypadal hůř než rovnou dobře zvolený systémový.
 */

const INK = "#0c0e1a";
const INK_500 = "#4a4f6a";
const PAPER = "#fafaf7";
const CTA = "#f59e0b";

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export interface EmailButton {
  label: string;
  url: string;
}

export interface EmailContent {
  preheader: string;
  heading: string;
  /** Odstavce. Prochází escapováním — HTML se sem nevkládá. */
  paragraphs: string[];
  button?: EmailButton;
  /** Drobný text pod tlačítkem, typicky platnost odkazu. */
  footnote?: string;
}

export function renderEmail(content: EmailContent): string {
  const { preheader, heading, paragraphs, button, footnote } = content;

  const body = paragraphs
    .map(
      (text) =>
        `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${INK_500};">${escapeHtml(text)}</p>`,
    )
    .join("");

  const buttonHtml = button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
         <tr><td style="border-radius:6px;background:${CTA};border:1px solid ${INK};">
           <a href="${escapeHtml(button.url)}"
              style="display:inline-block;padding:14px 28px;font-family:${FONT};
                     font-size:16px;font-weight:600;color:${INK};text-decoration:none;">
             ${escapeHtml(button.label)}
           </a>
         </td></tr>
       </table>
       <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:${INK_500};">
         Kdyby tlačítko nefungovalo, zkopírujte si tenhle odkaz do prohlížeče:
       </p>
       <p style="margin:0 0 16px;font-size:13px;line-height:1.5;word-break:break-all;">
         <a href="${escapeHtml(button.url)}" style="color:#4f46e5;">${escapeHtml(button.url)}</a>
       </p>`
    : "";

  const footnoteHtml = footnote
    ? `<p style="margin:0;font-size:13px;line-height:1.5;color:${INK_500};">${escapeHtml(footnote)}</p>`
    : "";

  return `<!doctype html>
<html lang="cs">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background:${PAPER};font-family:${FONT};">
  <!-- Náhledový text: to, co se ukáže ve schránce vedle předmětu. Bez něj
       tam Gmail vytáhne první větu hlavičky, tedy obvykle "Weeks Učebna". -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    ${escapeHtml(preheader)}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background:${PAPER};padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
             style="max-width:560px;background:#ffffff;border:1px solid rgba(12,14,26,0.15);border-radius:6px;">

        <tr><td style="padding:28px 32px 0;">
          <span style="font-size:20px;font-weight:700;color:${INK};letter-spacing:-0.02em;">Weeks</span>
          <span style="font-size:11px;text-transform:uppercase;letter-spacing:0.2em;color:#4f46e5;margin-left:8px;">Učebna</span>
        </td></tr>

        <tr><td style="padding:24px 32px 32px;">
          <h1 style="margin:0 0 20px;font-size:24px;line-height:1.25;font-weight:700;color:${INK};">
            ${escapeHtml(heading)}
          </h1>
          ${body}
          ${buttonHtml}
          ${footnoteHtml}
        </td></tr>

      </table>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
             style="max-width:560px;">
        <tr><td style="padding:20px 32px;text-align:center;">
          <p style="margin:0 0 6px;font-size:12px;line-height:1.5;color:${INK_500};">
            ${escapeHtml(CONTROLLER.name)}, IČO ${escapeHtml(CONTROLLER.ico)} ·
            <a href="mailto:${escapeHtml(CONTROLLER.email)}" style="color:${INK_500};">${escapeHtml(CONTROLLER.email)}</a>
          </p>
          <p style="margin:0;font-size:12px;line-height:1.5;color:${INK_500};">
            <a href="${escapeHtml(SITE.url)}" style="color:${INK_500};">${escapeHtml(SITE.url.replace(/^https?:\/\//, ""))}</a>
          </p>
        </td></tr>
      </table>

    </td></tr>
  </table>
</body>
</html>`;
}

/** Textová verze. Bez ní část filtrů hodnotí e-mail hůř. */
export function renderEmailText(content: EmailContent): string {
  const lines = [content.heading, "", ...content.paragraphs];

  if (content.button) {
    lines.push("", `${content.button.label}: ${content.button.url}`);
  }
  if (content.footnote) {
    lines.push("", content.footnote);
  }

  lines.push(
    "",
    "—",
    `${CONTROLLER.name}, IČO ${CONTROLLER.ico}`,
    CONTROLLER.email,
    SITE.url,
  );

  return lines.join("\n");
}
