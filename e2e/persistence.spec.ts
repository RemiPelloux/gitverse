import { expect, test, type Page } from "@playwright/test";

async function type(page: Page, cmd: string) {
  const input = page.getByRole("textbox", { name: "Command" });
  await input.fill(cmd);
  await input.press("Enter");
}

test("playground repository, terminal and history survive a reload", async ({ page }) => {
  await page.goto("/playground");
  await type(page, "git switch -c saved-branch");
  await type(page, 'echo "kept" > kept.txt && git add . && git commit -m "Persist me"');
  await expect(page.getByText("Saved locally")).toBeVisible();

  await page.reload();
  await expect(page.getByText("Restored · saved locally")).toBeVisible();
  await expect(page.getByRole("button", { name: /Commit [0-9a-f]{7}: Persist me \(HEAD\)/ })).toBeVisible();
  await expect(page.getByText("[saved-branch", { exact: false })).toBeVisible(); // terminal transcript
  await expect(page.getByText("kept.txt").first()).toBeVisible(); // file explorer
  const input = page.getByRole("textbox", { name: "Command" });
  await input.press("ArrowUp"); // command history
  await expect(input).toHaveValue(/Persist me/);

  // choosing a sandbox starts fresh (and that is what gets saved)
  await page.getByLabel("Choose a starting repository").selectOption("empty");
  await page.reload();
  await expect(page.getByText("No repository yet")).toBeVisible();
});

test("an unfinished lesson resumes with its terminal after a reload", async ({ page }) => {
  await page.goto("/learn/what-is-git");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await type(page, "git init");
  await expect(page.getByText("Initialized empty Git repository")).toBeVisible();
  await page.waitForTimeout(500); // autosave debounce
  await page.reload();
  await expect(page.getByText("Initialized empty Git repository")).toBeVisible();
  await expect(page.getByRole("status").getByText("Nice!")).toBeVisible();
});
