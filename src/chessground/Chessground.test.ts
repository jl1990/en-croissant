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
