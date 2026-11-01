import { expect, test, type Page } from "@playwright/test";

async function type(page: Page, cmd: string) {
  const input = page.getByRole("textbox", { name: "Command" });
  await input.fill(cmd);
  await input.press("Enter");
}

test("a newcomer completes lesson 1 and their first commit from the landing page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /start learning/i }).first().click();
  await expect(page).toHaveURL(/\/learn\/what-is-git/);

  // Discover x2
  await page.getByRole("button", { name: /edit & take a snapshot/i }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  // Try: git init (typed in Real-style)
  await type(page, "git init");
  await expect(page.getByText("Initialized empty Git repository")).toBeVisible();
  await expect(page.getByRole("status").getByText("Nice!")).toBeVisible();
  await page.getByRole("button", { name: /continue/i }).click();

  // Experiment → done
  await page.getByRole("button", { name: /done exploring/i }).click();
  await expect(page.getByRole("heading", { name: "Lesson complete!" })).toBeVisible();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "e2e/screens/celebrate.png" });
  await page.getByRole("link", { name: /next: your first commit/i }).click();

  // Lesson 2
  await page.getByRole("button", { name: "Continue" }).click(); // discover
  await page.getByRole("button", { name: "Create README.md" }).click();
  await page.getByRole("button", { name: /continue/i }).click();
  await type(page, "git status");
  await expect(page.getByText("Untracked files:").first()).toBeVisible();
  await page.getByRole("button", { name: /continue/i }).click();
  await page.getByRole("button", { name: "Run", exact: true }).click(); // assisted run: git add README.md
  await page.getByRole("button", { name: /continue/i }).click();
  await type(page, 'git commit -m "Initial commit"');
  await expect(page.getByText(/\[main \(root-commit\) [0-9a-f]{7}\] Initial commit/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Commit [0-9a-f]{7}: Initial commit \(HEAD\)/ })).toBeVisible();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "e2e/screens/first-commit.png" });
  await page.getByRole("button", { name: /continue/i }).click();

  // Challenge: validated by state
  await type(page, "touch hello.txt");
  await expect(page.getByText("hello.txt exists but is untracked")).toBeVisible();
  await type(page, 'git add hello.txt && git commit -m "Add hello"');
  await page.getByRole("button", { name: /complete lesson/i }).click();
  await expect(page.getByRole("heading", { name: "Lesson complete!" })).toBeVisible();

  // Progress persisted
  await page.goto("/learn");
  await expect(page.getByText("Changing files").first()).toBeVisible();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "e2e/screens/learn.png", fullPage: true });
});

test("branch + merge journey and conflict resolution through the editor", async ({ page }) => {
  // unlock everything via onboarding
  await page.goto("/learn");
  await page.getByLabel(/I use Git already/i).check();
  await page.getByRole("button", { name: /let's go/i }).click();

  await page.goto("/learn/merge-conflicts");
  await page.getByRole("button", { name: "Try to merge" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await type(page, "git merge feature/dark-mode");
  await expect(page.getByText("CONFLICT (content): Merge conflict in style.css")).toBeVisible();
  await expect(page.getByText("In plain words:")).toBeVisible();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "e2e/screens/conflict.png" });
  await page.getByRole("button", { name: /continue/i }).click();
  await page.getByRole("button", { name: "Accept both" }).click();
  await type(page, "git add style.css");
  await type(page, "git commit --no-edit");
  await expect(page.getByRole("button", { name: /complete lesson/i })).toBeEnabled();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "e2e/screens/resolved.png" });
});

test("playground: commands drive graph, files and remote", async ({ page }) => {
  await page.goto("/playground");
  await type(page, "git switch -c feature/x");
  await type(page, 'echo "x" > x.txt && git add . && git commit -m "X work"');
  await type(page, "git switch main");
  await type(page, "git merge --no-ff feature/x");
  await expect(page.getByText("Merge made by the 'ort' strategy.")).toBeVisible();
  await type(page, "git remote add origin https://github.com/you/sandbox.git");
  await type(page, "git push -u origin main");
  await expect(page.getByText("[new branch]")).toBeVisible();
  await page.getByRole("tab", { name: "Remote" }).click();
  await expect(page.getByText("in sync")).toBeVisible();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "e2e/screens/playground.png" });
  await type(page, "git bisect start");
  await expect(page.getByText(/isn't available in this simulator yet/)).toBeVisible();
});

test("landing and encyclopedia render", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /git commit -m/ }).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "e2e/screens/landing.png" });
  await page.goto("/commands");
  await page.getByRole("button", { name: "git rebase" }).click();
  await page.getByRole("button", { name: /run it/i }).click();
  await expect(page.getByText("Successfully rebased")).toBeVisible();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "e2e/screens/commands.png" });
});
