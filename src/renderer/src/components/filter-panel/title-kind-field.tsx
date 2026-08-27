import type { JSX } from 'react'
import { TITLE_KIND_OPTIONS, type TitleKind } from '../../../../shared/types'
import Select from '../select'
import Field from './field'

export default function TitleKindField({
  value,
  onChange
}: {
  value: TitleKind
  onChange: (titleKind: TitleKind) => void
}): JSX.Element {
  return (
    <Field label="Title type">
      <Select
        value={value}
        ariaLabel="Title type"
        options={TITLE_KIND_OPTIONS}
        onChange={(titleKind) => onChange(titleKind as TitleKind)}
      />
    </Field>
  )
}
