/// <reference types="vite/client" />

declare module "react-infinite-scroll-component" {
  import type { ComponentType, ReactNode } from "react";
  const InfiniteScroll: ComponentType<{
    children: ReactNode;
    dataLength: number;
    next: () => void;
    hasMore: boolean;
    loader?: ReactNode;
    endMessage?: ReactNode;
    scrollableTarget?: string;
  }>;
  export default InfiniteScroll;
}
