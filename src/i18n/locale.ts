export type Locale = "en" | "fr";

export const LOCALES: Array<{ id: Locale; label: string; short: string }> = [
  { id: "en", label: "English", short: "EN" },
  { id: "fr", label: "Français", short: "FR" },
];

/** Best guess from the browser, used until the learner picks a language. */
export function detectLocale(): Locale {
  try {
    const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
    return langs.some((l) => l?.toLowerCase().startsWith("fr")) ? "fr" : "en";
  } catch {
    return "en";
  }
}
