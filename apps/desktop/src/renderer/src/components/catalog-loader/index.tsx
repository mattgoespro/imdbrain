import type { JSX } from "react";
import Spinner from "./spinner";

export default function CatalogLoader({
  label,
}: {
  label: string;
}): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-[13px] text-muted">
      <Spinner />
      <p className="m-0">{label}</p>
    </div>
  );
}
