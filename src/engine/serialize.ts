import type { World } from "./types";

/** Versioned, URL-safe serialization for shareable scenarios. */
export function serializeWorld(world: World): string {
  const json = JSON.stringify({ v: world.version, w: world });
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function deserializeWorld(encoded: string): World | null {
  try {
    const b64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as { v: number; w: World };
    if (parsed.v !== 1 || !parsed.w || typeof parsed.w.workdir !== "object") return null;
    return parsed.w;
  } catch {
    return null;
  }
}
