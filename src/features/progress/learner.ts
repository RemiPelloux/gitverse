import type { World } from "@/engine";

/** Commits in lessons and the playground are signed with the learner's name, like `git config user.name`. */
export function withLearner(world: World, name: string): World {
  const n = name.trim();
  if (!n || world.user.name === n) return world;
  const slug = n.toLowerCase().normalize("NFD").replace(/[^\w]+/g, ".").replace(/^\.|\.$/g, "") || "you";
  return { ...world, user: { name: n, email: `${slug}@gitverse.dev` } };
}
