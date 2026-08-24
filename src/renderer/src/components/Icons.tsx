import type { JSX, SVGProps } from 'react'
import { cn } from '../lib/cn'

function Icon({ className, children, ...props }: SVGProps<SVGSVGElement>): JSX.Element {
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

export function IconSearch(props: SVGProps<SVGSVGElement>): JSX.Element {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </Icon>
  )
}

export function IconForYou(props: SVGProps<SVGSVGElement>): JSX.Element {
  return (
    <Icon {...props}>
      <path d="M12 3l2.2 6.6H21l-5.4 3.9 2.1 6.5L12 16.6 6.3 20l2.1-6.5L3 9.6h6.8z" />
    </Icon>
  )
}

export function IconLibrary(props: SVGProps<SVGSVGElement>): JSX.Element {
  return (
    <Icon {...props}>
      <path d="M4 5h5v14H4zM10 5h5v14h-5zM16 5h4v14h-4z" />
    </Icon>
  )
}

export function IconSettings(props: SVGProps<SVGSVGElement>): JSX.Element {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
    </Icon>
  )
}

export function IconList(props: SVGProps<SVGSVGElement>): JSX.Element {
  return (
    <Icon {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Icon>
  )
}

export function IconGrid(props: SVGProps<SVGSVGElement>): JSX.Element {
  return (
    <Icon {...props}>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </Icon>
  )
}

export function IconStar({ className, ...props }: SVGProps<SVGSVGElement>): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn('size-3 fill-current', className)} {...props}>
      <path d="M12 3l2.4 6.6H21l-5.3 3.9 2 6.5L12 16.8 6.3 20l2-6.5L3 9.6h6.6z" />
    </svg>
  )
}

export function IconRefresh(props: SVGProps<SVGSVGElement>): JSX.Element {
  return (
    <Icon {...props}>
      <path d="M4 12a8 8 0 0 1 13.7-5.6L20 8" />
      <path d="M20 4v4h-4" />
      <path d="M20 12a8 8 0 0 1-13.7 5.6L4 16" />
      <path d="M4 20v-4h4" />
    </Icon>
  )
}
