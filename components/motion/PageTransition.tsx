import { ViewTransition, type ReactNode } from "react";

/**
 * Route transition for a page's content.
 *
 * Wrap it around what a page.tsx renders — never in a layout: layouts persist
 * across navigations, so enter/exit would never fire there. The old page
 * leaves fast and low, the new one rises in after it (exit faster than enter,
 * so navigation never feels blocked). The sidebar and header are anchored in
 * CSS and do not move. `default="none"` keeps unrelated transitions (refresh,
 * Suspense reveals) from animating the page.
 *
 * Without View Transitions support in the browser, pages simply swap.
 */
export default function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter="page-enter" exit="page-exit" default="none">
      <div>{children}</div>
    </ViewTransition>
  );
}
