import type { JSX, SVGProps } from "react";
import Icon from "./icon";

export default function IconSettings(
  props: SVGProps<SVGSVGElement>,
): JSX.Element {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
    </Icon>
  );
}
