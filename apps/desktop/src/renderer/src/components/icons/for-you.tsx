import type { JSX, SVGProps } from "react";
import Icon from "./icon";

export default function IconForYou(
  props: SVGProps<SVGSVGElement>,
): JSX.Element {
  return (
    <Icon {...props}>
      <path d="M12 3l2.2 6.6H21l-5.4 3.9 2.1 6.5L12 16.6 6.3 20l2.1-6.5L3 9.6h6.8z" />
    </Icon>
  );
}
