import { fail, type Ctx } from "../context";

/** `git bisect`. TODO(engine-advanced). */
export function gitBisect(ctx: Ctx, args: string[]): void {
  void ctx;
  fail(`git bisect ${args[0] ?? ""}: not implemented yet`);
}
