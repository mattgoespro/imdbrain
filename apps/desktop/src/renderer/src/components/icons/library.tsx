import type { JSX, SVGProps } from 'react'
import Icon from './icon'

export default function IconLibrary(props: SVGProps<SVGSVGElement>): JSX.Element {
  return (
    <Icon {...props}>
      <path d="M4 5h5v14H4zM10 5h5v14h-5zM16 5h4v14h-4z" />
    </Icon>
  )
}
