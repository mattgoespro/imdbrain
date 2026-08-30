export function gridColumnCount(el: HTMLElement | null): number {
  if (!el) return 1;
  const template = getComputedStyle(el).gridTemplateColumns;
  if (!template || template === "none") return 1;
  return Math.max(1, template.split(/\s+/).filter(Boolean).length);
}

export function enterDelayMs(
  index: number,
  groupSize = 1,
  staggerMs = 20,
  maxSteps = 12,
): number {
  const step = Math.min(Math.floor(index / Math.max(1, groupSize)), maxSteps);
  return step * staggerMs;
}
