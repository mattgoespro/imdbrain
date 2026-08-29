import type { JSX, SVGProps } from 'react'
import Icon from './icon'

export default function IconSearch(props: SVGProps<SVGSVGElement>): JSX.Element {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </Icon>
  )
}
