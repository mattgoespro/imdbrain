import type { JSX, SVGProps } from 'react'
import Icon from './icon'

export default function IconGrid(props: SVGProps<SVGSVGElement>): JSX.Element {
  return (
    <Icon {...props}>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </Icon>
  )
}
