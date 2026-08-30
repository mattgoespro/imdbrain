import type { JSX, KeyboardEvent as ReactKeyboardEvent, Ref } from "react";
import { cn } from "../../lib/cn";
import Chevron from "./chevron";

export default function Trigger({
  buttonRef,
  open,
  label,
  ariaLabel,
  menuId,
  onClick,
  onKeyDown,
}: {
  buttonRef: Ref<HTMLButtonElement>;
  open: boolean;
  label: string;
  ariaLabel?: string;
  menuId: string;
  onClick: () => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>) => void;
}): JSX.Element {
  return (
    <button
      ref={buttonRef}
      type="button"
      className={cn(
        "flex w-full min-w-0 max-w-full items-center justify-between gap-2.5 rounded-app border bg-input px-3 py-2.5 text-left text-ink outline-none transition-colors duration-140",
        open ? "border-accent" : "border-line focus-visible:border-accent",
      )}
      aria-label={ariaLabel}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={menuId}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      <span className="min-w-0 truncate">{label}</span>
      <Chevron />
    </button>
  );
}
