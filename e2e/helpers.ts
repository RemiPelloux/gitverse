import type { Page } from "@playwright/test";

/** Start as a learner who already went through the welcome tour. */
export async function seedLearner(page: Page, state: Record<string, unknown> = {}) {
  await page.addInitScript((s) => {
    if (localStorage.getItem("gitverse-progress")) return;
    localStorage.setItem(
      "gitverse-progress",
      JSON.stringify({ version: 2, state: { onboarded: true, experience: "new", settings: { locale: "en", theme: "light", motion: "system", terminalMode: "assisted", showStreak: true, dailyGoal: 60 }, ...s } }),
    );
  }, state);
}
