import type { JSX } from "react";
import type { MovieDetails } from "../../../../shared/types";
import { posterUrl } from "../../../../shared/types";

export default function CastCard({
  person,
}: {
  person: NonNullable<MovieDetails["cast"]>[number];
}): JSX.Element {
  return (
    <div className="min-w-[72px] text-[11px] text-muted">
      {person.profilePath ? (
        <img
          className="block size-[72px] rounded-[10px] bg-poster object-cover"
          src={posterUrl(person.profilePath, "w185") ?? ""}
          alt=""
        />
      ) : (
        <div className="grid size-[72px] place-items-center rounded-[10px] bg-poster">
          {person.name.slice(0, 1)}
        </div>
      )}
      <b className="mt-1.5 block text-[11px] font-semibold text-ink">
        {person.name}
      </b>
      <div>{person.character}</div>
    </div>
  );
}
