import type { JSX } from "react";
import {
  SORT_OPTIONS,
  mediaTypeOf,
  type DiscoverFilters,
  type TitleKind,
} from "../../../../shared/types";
import Select from "../select";
import Field from "./field";

export default function SortField({
  titleKind,
  value,
  onChange,
}: {
  titleKind: TitleKind;
  value: DiscoverFilters["sortBy"];
  onChange: (sortBy: DiscoverFilters["sortBy"]) => void;
}): JSX.Element {
  return (
    <Field label="Sort">
      <Select
        value={value}
        ariaLabel="Sort"
        options={
          mediaTypeOf(titleKind) === "tv"
            ? SORT_OPTIONS.filter((option) => option.value !== "revenue.desc")
            : SORT_OPTIONS
        }
        onChange={onChange}
      />
    </Field>
  );
}
