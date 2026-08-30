import type { ImdbrainAPI } from "./index";

declare global {
  interface Window {
    api: ImdbrainAPI;
  }
}

export {};
