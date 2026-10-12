export type SheetSize = number | `${number}%`;

/**
 * How far the keyboard covers the bottom of the window.
 * Zero when there is no keyboard, or when the window already ends at the keyboard
 * (Android resized the window).
 */
export function keyboardOverlap(windowHeight: number, keyboardScreenY: number | null): number {
  if (
    keyboardScreenY === null ||
    !Number.isFinite(windowHeight) ||
    !Number.isFinite(keyboardScreenY) ||
    windowHeight <= 0 ||
    keyboardScreenY <= 0 ||
    keyboardScreenY >= windowHeight
  ) {
    return 0;
  }
  return windowHeight - keyboardScreenY;
}

/**
 * Sheet height that stays above the keyboard. Percentages are of the full window, so once
 * the keyboard is open they are converted to pixels and capped by the space that remains.
 */
export function sheetSizeAboveKeyboard(input: {
  windowHeight: number;
  keyboardInset: number;
  topInset: number;
  requested?: SheetSize;
}): SheetSize {
  if (input.keyboardInset <= 0) {
    return input.requested ?? '80%';
  }

  const available = Math.max(
    0,
    input.windowHeight - input.keyboardInset - Math.max(0, input.topInset),
  );
  const requestedPx =
    input.requested === undefined
      ? input.windowHeight * 0.8
      : typeof input.requested === 'number'
        ? input.requested
        : (Number.parseFloat(input.requested) / 100) * input.windowHeight;

  if (!Number.isFinite(requestedPx)) {
    return available;
  }
  return Math.min(Math.max(0, requestedPx), available);
}
