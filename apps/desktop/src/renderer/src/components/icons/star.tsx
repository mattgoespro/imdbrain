import type { JSX, SVGProps } from "react";
import { cn } from "../../lib/cn";

export default function IconStar({
  className,
  ...props
}: SVGProps<SVGSVGElement>): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn("size-3 fill-current", className)}
      {...props}
    >
      <path d="M12 3l2.4 6.6H21l-5.3 3.9 2 6.5L12 16.8 6.3 20l2-6.5L3 9.6h6.6z" />
    </svg>
  );
}
