import type { JSX, SVGProps } from 'react'
import { cn } from '../../lib/cn'

export default function Icon({
  className,
  children,
  ...props
}: SVGProps<SVGSVGElement>): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn(
        'size-4.5 fill-none stroke-current stroke-[1.75] [stroke-linecap:round] [stroke-linejoin:round]',
        className
      )}
      {...props}
    >
      {children}
    </svg>
  )
}
