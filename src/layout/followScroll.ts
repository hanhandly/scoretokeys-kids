export interface FollowViewport {
  scrollTop: number;
  scrollLeft: number;
  width: number;
  height: number;
}

export interface FollowTarget {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export function calculateFollowScroll(
  viewport: FollowViewport,
  target: FollowTarget,
): { top: number; left: number } {
  const verticallyVisible =
    target.top >= viewport.height * 0.18 &&
    target.bottom <= viewport.height * 0.72;
  const horizontallyVisible =
    target.left >= viewport.width * 0.12 &&
    target.right <= viewport.width * 0.88;

  return {
    top: verticallyVisible
      ? viewport.scrollTop
      : Math.max(0, viewport.scrollTop + target.top - viewport.height * 0.34),
    left: horizontallyVisible
      ? viewport.scrollLeft
      : Math.max(0, viewport.scrollLeft + target.left - viewport.width * 0.45),
  };
}
