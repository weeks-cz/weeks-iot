import type { ThemeOption } from "@/types";

export const STYLE_OPTIONS: ThemeOption[] = [
  { id: "classic",  label: "Classic",  description: "Původní vzhled screenu.",                                            accent: "blue",   unlockType: "default" },
  { id: "sunrise",  label: "Sunrise",  description: "Teplejší barvy a světlejší akcenty.",                                accent: "orange", unlockType: "shop" },
  { id: "forest",   label: "Forest",   description: "Zelenější laboratorní styl.",                                        accent: "green",  unlockType: "shop" },
  { id: "ice",      label: "Ice",      description: "Chladný modrý styl s ostřejšími kontrasty.",                         accent: "cyan",   unlockType: "shop" },
  { id: "ember",    label: "Ember",    description: "Těžký červeno-oranžový styl s výrazným kontrastem.",                 accent: "red",    unlockType: "shop" },
  { id: "lagoon",   label: "Lagoon",   description: "Tyrkysový styl inspirovaný vodou a laboratorní grafikou.",           accent: "teal",   unlockType: "shop" },
  { id: "sand",     label: "Sand",     description: "Světlejší pískový motiv s teplými akcenty.",                          accent: "sand",   unlockType: "shop" },
  { id: "midnight", label: "Midnight", description: "Hluboká noční paleta s tmavými odstíny.",                            accent: "purple", unlockType: "shop" },
  { id: "volt",     label: "Volt",     description: "Elektricky zelený styl s ostřejším game-lab feelingem.",              accent: "lime",   unlockType: "shop" },
];

export function getTheme(id: string): ThemeOption | undefined {
  return STYLE_OPTIONS.find((t) => t.id === id);
}

export function applyTheme(themeId: string): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", themeId);
}
