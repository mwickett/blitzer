// Soft guard: any integer in the prose that is not present in the facts is a
// candidate hallucination. Used as a runtime warning and as the seed of the
// fact-based eval. Works on any plain facts object.
export function collectFactNumbers(facts: unknown): Set<string> {
  const nums = new Set<string>();
  const walk = (v: unknown): void => {
    if (typeof v === "number") nums.add(String(v));
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(facts);
  return nums;
}

export function findUngroundedNumbers(text: string, facts: unknown): string[] {
  const allowed = collectFactNumbers(facts);
  const inText = text.match(/-?\d+/g) ?? [];
  return inText.filter((n) => !allowed.has(n));
}
