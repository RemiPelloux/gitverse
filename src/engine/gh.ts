import { fail, type Ctx } from "./context";

/**
 * Simulated GitHub CLI (`gh`). Works against `world.hosted`, the simulated GitHub.
 * TODO(engine-github): pr / issue / release / run / secret subcommands.
 */
export function runGh(ctx: Ctx, args: string[]): void {
  void ctx;
  fail(`gh: '${args[0] ?? ""}' is not available yet.`);
}
