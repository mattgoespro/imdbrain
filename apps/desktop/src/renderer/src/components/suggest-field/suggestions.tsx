import type { JSX } from "react";

export default function Suggestions<T extends { id: number; name: string }>({
  hits,
  onSelect,
}: {
  hits: T[];
  onSelect: (item: T) => void;
}): JSX.Element | null {
  if (!hits.length) return null;
  return (
    <div className="absolute top-[calc(100%+0.25rem)] right-0 left-0 z-6 overflow-hidden rounded-app border border-line bg-raised shadow-panel">
      {hits.map((hit) => (
        <button
          key={hit.id}
          type="button"
          className="block w-full border-0 bg-transparent px-2.5 py-2 text-left hover:bg-accent-soft"
          onClick={() => onSelect(hit)}
        >
          {hit.name}
        </button>
      ))}
    </div>
  );
}
