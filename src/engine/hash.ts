/**
 * Deterministic 40-hex-char object id. Not cryptographic; it only needs to be
 * stable for identical input so simulations are reproducible and shareable.
 */
export function objectId(input: string): string {
  const parts: string[] = [];
  for (let k = 0; k < 5; k++) {
    let h = 0x811c9dc5 ^ (k * 0x9e3779b1);
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 0x01000193 + k * 2);
      h ^= h >>> 13;
    }
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
    h ^= h >>> 13;
    parts.push((h >>> 0).toString(16).padStart(8, "0"));
  }
  return parts.join("");
}

export const shortId = (id: string) => id.slice(0, 7);
