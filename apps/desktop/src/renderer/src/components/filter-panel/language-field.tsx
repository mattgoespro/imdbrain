import type { JSX } from "react";
import { LANGUAGES } from "../../../../shared/types";
import Select from "../select";
import Field from "./field";

export default function LanguageField({
  value,
  onChange,
}: {
  value: string;
  onChange: (language: string) => void;
}): JSX.Element {
  return (
    <Field label="Original language">
      <Select
        value={value}
        ariaLabel="Original language"
        options={LANGUAGES.map((lang) => ({
          value: lang.code,
          label: lang.label,
        }))}
        onChange={onChange}
      />
    </Field>
  );
}
