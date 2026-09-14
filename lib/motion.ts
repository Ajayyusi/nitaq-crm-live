import type { CSSProperties } from "react";

/**
 * Position in a staggered entrance. The motion utilities in app/globals.css
 * (`motion-rise`, `motion-row`, `motion-bar`) turn `--stagger` into a delay,
 * and cap it so long lists never make the last item wait.
 */
export function stagger(index: number): CSSProperties {
  return { "--stagger": index } as CSSProperties;
}
