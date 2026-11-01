import { emptyWorld, type World } from "@/engine";
import { INDEX_HTML, README, Scenario, scenario, STYLE_CSS } from "@/features/curriculum/scenario";

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

export const SANDBOXES: Array<{ id: string; title: string; description: string; build: () => World }> = [
  { id: "empty", title: "Empty folder", description: "Start from nothing: git init, or git clone a repo.", build: () => withHosting(emptyWorld()) },
  {
    id: "website",
    title: "Starter website",
    description: "A repository with a few commits.",
    build: () =>
      withHosting(
        scenario().run("git init").commit("Add README", { "README.md": README }).commit("Add home page", { "index.html": INDEX_HTML }).commit("Add styles", { "style.css": STYLE_CSS }).done(),
      ),
  },
  {
    id: "branches",
    title: "Diverged branches",
    description: "main and two feature branches — try merge vs. rebase.",
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
    title: "Merge conflict",
    description: "Two branches edited the same line. Merge them and resolve.",
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
    title: "Connected to GitHub",
    description: "Already pushed to origin. Try push, fetch and pull.",
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
