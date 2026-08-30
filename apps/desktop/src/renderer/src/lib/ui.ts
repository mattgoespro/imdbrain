import { cn } from "./cn";

export function btn(
  ...variants: Array<
    | "primary"
    | "gold"
    | "ghost"
    | "danger"
    | "link"
    | "compact"
    | false
    | undefined
  >
): string {
  const primary = variants.includes("primary") || variants.includes("gold");
  const danger = variants.includes("danger");
  const ghost = variants.includes("ghost");
  const compact = variants.includes("compact");
  return cn(
    "app-no-drag rounded-full border font-semibold transition-colors duration-140 disabled:cursor-not-allowed disabled:opacity-45",
    compact ? "h-7 px-2.5 py-0 text-[11px]" : "px-3.5 py-2 text-[13px]",
    primary
      ? "border-transparent bg-linear-to-b from-accent-2 to-accent text-accent-ink shadow-accent hover:from-accent-2 hover:to-accent hover:text-accent-ink"
      : danger
        ? "border-(--color-danger-ring) bg-transparent text-danger hover:bg-wash-9"
        : ghost
          ? "border-line bg-transparent text-ink hover:bg-wash-9"
          : "border-line bg-wash text-ink hover:bg-wash-9",
    variants.includes("link") && "inline-flex items-center no-underline",
  );
}

export function iconBtn(
  ...variants: Array<"primary" | "busy" | false | undefined>
): string {
  return cn(
    "grid size-10 shrink-0 place-items-center rounded-xl border p-0",
    variants.includes("primary")
      ? "border-transparent bg-linear-to-b from-accent-2 to-accent text-accent-ink shadow-accent hover:from-accent-2 hover:to-accent hover:text-accent-ink"
      : "border-line bg-wash text-muted hover:bg-wash-9 hover:text-ink",
    variants.includes("busy") && "[&_svg]:animate-catalog",
  );
}

export function rankedRow(active = false, extra?: string): string {
  return cn(
    "grid w-full cursor-pointer grid-cols-[48px_52px_minmax(0,1fr)_auto] items-center gap-3.5 rounded-none border-0 border-b border-line px-1.5 py-2.5 text-left text-inherit",
    active
      ? "inset-accent bg-accent-soft hover:bg-accent-soft"
      : "bg-transparent hover:bg-wash-3",
    extra,
  );
}

export function rankedThumb(): string {
  return "poster-ph h-19.5 w-13 rounded-md object-cover";
}

export const rangeInputClass =
  "h-1 w-full min-w-0 flex-1 appearance-none rounded-full bg-track outline-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:shadow-[0_0_0_4px_var(--color-accent-soft)]";
