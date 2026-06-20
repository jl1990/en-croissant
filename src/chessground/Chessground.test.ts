import { describe, expect, it } from "vitest";
import { getBoardCoordinateColors, BOARD_COORDINATE_COLORS } from "./Chessground";

describe("getBoardCoordinateColors", () => {
  it("returns known colors for a .svg board", () => {
    const colors = getBoardCoordinateColors("gray.svg");
    expect(colors).toEqual({ white: "#e9ecef", black: "#868e96" });
  });

  it("returns known colors for a .png board", () => {
    const colors = getBoardCoordinateColors("blue.png");
    expect(colors).toEqual({ white: "#dee3e6", black: "#788a94" });
  });

  it("returns known colors for a .jpg board", () => {
    const colors = getBoardCoordinateColors("wood.jpg");
    expect(colors).toEqual({ white: "#d8a45b", black: "#9b4d0f" });
  });

  it("strips extension to find the key", () => {
    const colors = getBoardCoordinateColors("maple2.jpg");
    expect(colors).toEqual({ white: "#e2c89f", black: "#963" });
  });

  it("returns fallback colors for unknown board", () => {
    const colors = getBoardCoordinateColors("nonexistent.png");
    expect(colors).toEqual({
      white: "rgba(255, 255, 255, 0.8)",
      black: "rgba(72, 72, 72, 0.8)",
    });
  });
});

describe("BOARD_COORDINATE_COLORS", () => {
  it("contains all known board image entries", () => {
    const keys = Object.keys(BOARD_COORDINATE_COLORS);
    expect(keys).toContain("gray");
    expect(keys).toContain("blue");
    expect(keys).toContain("wood");
    expect(keys).toContain("newspaper");
    expect(keys.length).toBeGreaterThanOrEqual(25);
  });
});

describe("Chessground wrapper config change detection", () => {
  it("deepEqual detects changes in events objects", async () => {
    // deepEqual from fast-deep-equal/es6 is used in ChessgroundInner to detect
    // config changes. Verify it correctly compares events objects.
    const deepEqual = (await import("fast-deep-equal/es6")).default;

    const a = { select: () => {}, change: () => {} };
    const b = { select: () => {}, change: () => {} };
    // fresh closures should not be deep-equal (reference inequality)
    expect(deepEqual(a, b)).toBe(false);

    // same reference should be equal
    const same = a;
    expect(deepEqual(a, same)).toBe(true);

    // null vs undefined
    expect(deepEqual(null, undefined)).toBe(false);
    expect(deepEqual(null, null)).toBe(true);
  });

  it("deepEqual detects changes in nested drawable config", async () => {
    const deepEqual = (await import("fast-deep-equal/es6")).default;
    const a = { eraseOnClick: true, shapes: [{ orig: "e2", dest: "e4", brush: "blue" }] };
    const b = { eraseOnClick: true, shapes: [{ orig: "e2", dest: "e4", brush: "blue" }] };
    // Same structure should be deep equal
    expect(deepEqual(a, b)).toBe(true);

    const c = { eraseOnClick: true, shapes: [{ orig: "e2", dest: "e5", brush: "blue" }] };
    expect(deepEqual(a, c)).toBe(false);
  });

  it("mergeDraggable respects moveMethod taking precedence", () => {
    // When moveMethod is "select", draggable.enabled should be forced to false
    // This mirrors the logic in ChessgroundInner's mergedDraggable useMemo.
    const merge = (moveMethod: string, parentEnabled?: boolean) => ({
      enabled: moveMethod !== "select",
      ...(parentEnabled !== undefined ? { parentEnabled } : {}),
    });

    expect(merge("drag").enabled).toBe(true);
    expect(merge("select").enabled).toBe(false);
    expect(merge("drag", true).enabled).toBe(true);
    expect(merge("select", true).enabled).toBe(false);
    expect(merge("select", false).enabled).toBe(false);
  });
});
