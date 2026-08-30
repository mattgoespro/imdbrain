import type { BrowserWindow } from "electron";
import {
  THEME_CANVAS,
  normalizeAccentColor,
  normalizeThemeMode,
  windowSymbolColor,
} from "../shared/appearance";
import type { Settings } from "../shared/types";

export function windowBackgroundColor(
  settings: Pick<Settings, "themeMode">,
): string {
  return THEME_CANVAS[normalizeThemeMode(settings.themeMode)];
}

export function applyWindowChrome(
  win: BrowserWindow | null,
  settings: Settings,
): void {
  if (!win || win.isDestroyed()) return;
  const themeMode = normalizeThemeMode(settings.themeMode);
  const accentColor = normalizeAccentColor(settings.accentColor);
  const backgroundColor = THEME_CANVAS[themeMode];
  win.setBackgroundColor(backgroundColor);
  try {
    win.setTitleBarOverlay({
      color: backgroundColor,
      symbolColor: windowSymbolColor(accentColor, themeMode),
      height: 36,
    });
  } catch {
    /* titleBarOverlay is not available on every platform */
  }
}
