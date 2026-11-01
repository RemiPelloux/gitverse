import { expect, test } from "@playwright/test";

test("first lesson is completable on a phone", async ({ page }) => {
  await page.goto("/learn/what-is-git");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  // Guide tab is first on mobile; run the suggested command from the guide.
  await page.getByRole("button", { name: /run it for me/i }).click();
  await expect(page.getByText("Your folder is now a Git repository!")).toBeVisible();
  await page.getByRole("button", { name: "Terminal" }).click();
  await expect(page.getByText("Initialized empty Git repository")).toBeVisible();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "e2e/screens/mobile-terminal.png" });
  await page.getByRole("button", { name: "Guide" }).click();
  await page.getByRole("button", { name: /continue/i }).click();
  await page.getByRole("button", { name: /done exploring/i }).click();
  await expect(page.getByRole("heading", { name: "Lesson complete!" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});
