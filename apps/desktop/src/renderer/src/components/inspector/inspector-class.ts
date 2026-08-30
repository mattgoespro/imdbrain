import { cn } from "../../lib/cn";

export function inspectorClass(docked?: boolean): string {
  return cn(
    "min-h-0 max-h-[34vh] overflow-auto border-t border-line bg-transparent p-0 inspect:max-h-none inspect:border-t-0 inspect:border-l",
    docked && "max-inspect:col-start-2 max-inspect:max-h-[34vh]",
  );
}
