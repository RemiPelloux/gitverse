import { emptyWorld, type World } from "@/engine";
import { INDEX_HTML, README, Scenario, scenario, STYLE_CSS } from "@/features/curriculum/scenario";
import type { MessageKey } from "@/i18n";

export const HELLO_URL = "https://github.com/gitverse/hello-world.git";
export const SANDBOX_URL = "https://github.com/you/sandbox.git";

/** Every sandbox gets a simulated GitHub with a cloneable repo and an empty one to push to. */
export function withHosting(w: World): World {
  const hello = new Scenario(emptyWorld())
    .run('git config user.name "Octo"', "git init")
    .commit("Initial commit", { "README.md": "# Hello, World!\n\nClone me with git clone.\n" }, "Octo")
    .commit("Add greeting", { "hello.py": 'print("Hello, world!")\n' }, "Octo")
    .host(HELLO_URL, "gitverse", "hello-world")
    .run(`git remote add origin ${HELLO_URL}`, "git push -u origin main")
    .done();
  return {
    ...w,
    hosted: { ...hello.hosted, [SANDBOX_URL]: { url: SANDBOX_URL, owner: "you", name: "sandbox", branches: {}, defaultBranch: "main" }, ...w.hosted },
    hostedCommits: { ...hello.hostedCommits, ...w.hostedCommits },
    clock: Math.max(w.clock, hello.clock),
    seq: Math.max(w.seq, hello.seq),
  };
}

export type SandboxId = "empty" | "website" | "branches" | "conflict" | "remote";

/** Message keys for a sandbox's title and description (translate at render time). */
export const sandboxText = (id: SandboxId) => ({
  title: `lab.sandboxes.${id}.title` as const satisfies MessageKey,
  description: `lab.sandboxes.${id}.description` as const satisfies MessageKey,
});

export const SANDBOXES: Array<{ id: SandboxId; build: () => World }> = [
  { id: "empty", build: () => withHosting(emptyWorld()) },
  {
    id: "website",
    build: () =>
      withHosting(
        scenario().run("git init").commit("Add README", { "README.md": README }).commit("Add home page", { "index.html": INDEX_HTML }).commit("Add styles", { "style.css": STYLE_CSS }).done(),
      ),
  },
  {
    id: "branches",
    build: () =>
      withHosting(
        scenario()
          .run("git init")
          .commit("Add README", { "README.md": README })
          .run("git switch -c feature/login")
          .commit("Add login form", { "login.html": "<form>login</form>\n" })
          .commit("Validate password", { "login.js": "validate()\n" })
          .run("git switch main", "git switch -c feature/search")
          .commit("Add search box", { "search.html": "<input>\n" })
          .run("git switch main")
          .commit("Fix typo", { "README.md": README.replace("tiny", "small") }, "Maya")
          .done(),
      ),
  },
  {
    id: "conflict",
    build: () =>
      withHosting(
        scenario()
          .run("git init")
          .commit("Add styles", { "style.css": STYLE_CSS })
          .run("git switch -c theme")
          .commit("Green theme", { "style.css": STYLE_CSS.replace("navy", "green") })
          .run("git switch main")
          .commit("Red theme", { "style.css": STYLE_CSS.replace("navy", "red") }, "Maya")
          .done(),
      ),
  },
  {
    id: "remote",
    build: () => {
      const base = withHosting(emptyWorld());
      return new Scenario(base)
        .run("git init")
        .commit("Add README", { "README.md": README })
        .run(`git remote add origin ${SANDBOX_URL}`, "git push -u origin main")
        .done();
    },
  },
];

export const buildSandbox = (id: string) => (SANDBOXES.find((s) => s.id === id) ?? SANDBOXES[0]).build();
