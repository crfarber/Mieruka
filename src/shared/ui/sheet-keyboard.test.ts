import { describe, expect, it } from 'vitest';
import { keyboardOverlap, sheetSizeAboveKeyboard } from './sheet-keyboard';

describe('keyboardOverlap', () => {
  it('measures how far the keyboard covers the bottom of the window', () => {
    expect(keyboardOverlap(800, 500)).toBe(300);
  });

  it('stays zero when the window already ends at or above the keyboard', () => {
    expect(keyboardOverlap(500, 500)).toBe(0);
    expect(keyboardOverlap(500, 560)).toBe(0);
  });

  it('stays zero without a usable keyboard frame', () => {
    expect(keyboardOverlap(800, null)).toBe(0);
    expect(keyboardOverlap(800, 0)).toBe(0);
    expect(keyboardOverlap(0, 100)).toBe(0);
  });
});

describe('sheetSizeAboveKeyboard', () => {
  it('keeps the requested size while the keyboard is hidden', () => {
    expect(
      sheetSizeAboveKeyboard({
        windowHeight: 800,
        keyboardInset: 0,
        topInset: 47,
        requested: '85%',
      }),
    ).toBe('85%');
    expect(sheetSizeAboveKeyboard({ windowHeight: 800, keyboardInset: 0, topInset: 47 })).toBe(
      '80%',
    );
  });

  it('caps a tall sheet to the space above the keyboard and the status bar', () => {
    expect(
      sheetSizeAboveKeyboard({
        windowHeight: 800,
        keyboardInset: 300,
        topInset: 50,
        requested: '80%',
      }),
    ).toBe(450);
  });

  it('keeps a short requested height when it already fits above the keyboard', () => {
    expect(
      sheetSizeAboveKeyboard({
        windowHeight: 800,
        keyboardInset: 100,
        topInset: 50,
        requested: 200,
      }),
    ).toBe(200);
  });

  it('uses at most 80% of the window when the sheet has no requested size', () => {
    expect(sheetSizeAboveKeyboard({ windowHeight: 800, keyboardInset: 100, topInset: 50 })).toBe(
      640,
    );
    expect(sheetSizeAboveKeyboard({ windowHeight: 800, keyboardInset: 300, topInset: 50 })).toBe(
      450,
    );
  });
});
