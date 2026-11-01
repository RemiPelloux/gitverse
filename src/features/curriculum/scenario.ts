import { emptyWorld, execute, type FileMap, type World } from "@/engine";

/** Fluent, deterministic scenario builder for lesson setups. */
export class Scenario {
  constructor(public world: World = emptyWorld()) {}

  files(files: FileMap) {
    this.world = { ...this.world, workdir: { ...this.world.workdir, ...files } };
    return this;
  }

  remove(...paths: string[]) {
    const workdir = { ...this.world.workdir };
    for (const p of paths) delete workdir[p];
    this.world = { ...this.world, workdir };
    return this;
  }

  run(...commands: string[]) {
    for (const c of commands) {
      const r = execute(this.world, c);
      if (!r.ok) throw new Error(`Scenario command failed: ${c}\n${r.lines.map((l) => l.text).join("\n")}`);
      this.world = r.world;
    }
    return this;
  }

  /** Run a command that is expected to fail (e.g. produce a conflict) but keep its state. */
  runAllowingFailure(command: string) {
    this.world = execute(this.world, command).world;
    return this;
  }

  commit(message: string, files: FileMap, author?: string) {
    this.files(files);
    if (author) this.run(`git config user.name "${author}"`);
    this.run("git add .", `git commit -m "${message.replace(/"/g, '\\"')}"`);
    if (author) this.run(`git config user.name "You"`);
    return this;
  }

  host(url: string, owner: string, name: string) {
    this.world = {
      ...this.world,
      hosted: { ...this.world.hosted, [url]: { url, owner, name, branches: {}, defaultBranch: "main" } },
    };
    return this;
  }

  done() {
    return this.world;
  }
}

export const scenario = (files: FileMap = {}) => new Scenario(emptyWorld(files));

export const README = "# My Project\n\nA tiny website I'm building while learning Git.\n";
export const INDEX_HTML = "<h1>Welcome!</h1>\n<p>This is my site.</p>\n";
export const STYLE_CSS = "body {\n  font-family: sans-serif;\n  color: navy;\n}\n";
