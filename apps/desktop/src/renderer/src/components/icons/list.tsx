import type { JSX, SVGProps } from 'react'
import Icon from './icon'

export default function IconList(props: SVGProps<SVGSVGElement>): JSX.Element {
  return (
    <Icon {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Icon>
  )
}
