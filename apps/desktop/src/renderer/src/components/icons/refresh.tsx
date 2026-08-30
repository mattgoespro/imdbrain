import type { JSX, SVGProps } from "react";
import Icon from "./icon";

export default function IconRefresh(
  props: SVGProps<SVGSVGElement>,
): JSX.Element {
  return (
    <Icon {...props}>
      <path d="M4 12a8 8 0 0 1 13.7-5.6L20 8" />
      <path d="M20 4v4h-4" />
      <path d="M20 12a8 8 0 0 1-13.7 5.6L4 16" />
      <path d="M4 20v-4h4" />
    </Icon>
  );
}
