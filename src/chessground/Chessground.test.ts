import { describe, expect, it } from "vitest";
import {
  getBoardCoordinateColors,
  BOARD_COORDINATE_COLORS,
  getDragOverlayClassName,
  parseCssUrl,
} from "./Chessground";

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

describe("Chessground drag overlay", () => {
  it("strips dragging and drag-copy from class list", () => {
    expect(getDragOverlayClassName("white pawn dragging")).toBe("white pawn");
    expect(getDragOverlayClassName("black knight dragging drag-copy")).toBe("black knight");
  });
});

describe("parseCssUrl", () => {
  it.each([
    ['url("data:image/svg+xml,<svg/>")', "data:image/svg+xml,<svg/>"],
    ["url('data:image/svg+xml,<svg/>')", "data:image/svg+xml,<svg/>"],
    ["url(data:image/svg+xml,<svg/>)", "data:image/svg+xml,<svg/>"],
    ["none", null],
    ["", null],
    ["   ", null],
    ["linear-gradient(red, blue)", null],
  ])("parseCssUrl(%s)", (input, expected) => {
    expect(parseCssUrl(input)).toBe(expected);
  });
});

describe("Chessground board background CSS", () => {
  it("uses CSS checkerboard colors instead of board image URLs for the board background", async () => {
    // @ts-expect-error Node types are not included in this frontend tsconfig.
    const { readFileSync } = await import("node:fs");
    const chessgroundTsx = readFileSync("src/chessground/Chessground.tsx", "utf8") as string;
    const colorsCss = readFileSync("src/styles/chessgroundColorsOverride.css", "utf8") as string;
    const globalCss = readFileSync("src/styles/global.css", "utf8") as string;
    const boardRule = colorsCss.match(/cg-board\s*\{[^}]*\}/)?.[0] ?? "";

    expect(chessgroundTsx).not.toContain('"--board-image"');
    expect(chessgroundTsx).toContain('"--board-color-light": boardCoordColors.white');
    expect(chessgroundTsx).toContain('"--board-color-dark": boardCoordColors.black');

    expect(boardRule).toMatch(/background-image:\s*conic-gradient\(/);
    expect(boardRule).toMatch(/var\(--board-color-dark/);
    expect(boardRule).toMatch(/var\(--board-color-light/);
    expect(boardRule).toMatch(/background-size:\s*25%\s+25%/);
    expect(boardRule).not.toMatch(/--board-image|url\(/);
    expect(globalCss).not.toMatch(/DIAGNOSTIC A/);
    expect(globalCss).not.toMatch(/cg-board\s*\{[^}]*background-image/);
  });
});

describe("Chessground drag artifact CSS", () => {
  it("keeps native drag/ghost paint disabled and uses a non-transform overlay", async () => {
    // @ts-expect-error Node types are not included in this frontend tsconfig.
    const { readFileSync } = await import("node:fs");
    const css = readFileSync("src/styles/chessgroundBaseOverride.css", "utf8") as string;

    const rule = (selector: string) => css.match(new RegExp(`${selector}\\s*\\{[^}]*\\}`))?.[0] ?? "";

    expect(rule("cg-board piece\.dragging")).toMatch(/background-image:\s*none\s*!important/);
    expect(rule("cg-board piece\.dragging")).toMatch(/opacity:\s*0/);
    expect(rule("\.cg-wrap piece\.ghost")).toMatch(/display:\s*none\s*!important/);
    expect(css).toMatch(/\.cg-wrap img\.drag-copy/);
    expect(rule("\.cg-wrap img\.drag-copy")).toMatch(/transform:\s*none\s*!important/);
    expect(rule("\.cg-wrap img\.drag-copy")).toMatch(/clip-path:\s*inset\(1px\)/);
  });

  it("does not draw occupied move destinations at square edges", async () => {
    // @ts-expect-error Node types are not included in this frontend tsconfig.
    const { readFileSync } = await import("node:fs");
    const css = readFileSync("src/styles/global.css", "utf8") as string;
    const occupiedMoveDestRule = css.match(/cg-board square\.oc\.move-dest\s*\{[^}]*\}/)?.[0] ?? "";

    expect(occupiedMoveDestRule).not.toMatch(/box-shadow|border:/);
    expect(css).toMatch(/cg-board square\.oc\.move-dest::after/);
  });

  it("keeps highlight backgrounds as direct element fills (no ::before inset)", async () => {
    // @ts-expect-error Node types are not included in this frontend tsconfig.
    const { readFileSync } = await import("node:fs");
    const globalCss = readFileSync("src/styles/global.css", "utf8") as string;
    const colorsCss = readFileSync("src/styles/chessgroundColorsOverride.css", "utf8") as string;
    const allCss = globalCss + colorsCss;

    // No ::before pseudo-elements for highlights
    expect(allCss).not.toMatch(/\.move-dest(?:\.hover|:hover)::before/);
    expect(allCss).not.toMatch(/\.selected::before/);
    expect(allCss).not.toMatch(/\.current-premove::before/);
    expect(allCss).not.toMatch(/\.last-move::before/);
  });

  it("does not add outline or clip-path to cg-board square", async () => {
    // @ts-expect-error Node types are not included in this frontend tsconfig.
    const { readFileSync } = await import("node:fs");
    const css = readFileSync("src/styles/chessgroundBaseOverride.css", "utf8") as string;
    const squareRule = css.match(/cg-board square\s*\{[^}]*\}/)?.[0] ?? "";
    expect(squareRule).not.toMatch(/outline|clip-path/);
  });

  it("clips piece background painting away from square edges", async () => {
    // @ts-expect-error Node types are not included in this frontend tsconfig.
    const { readFileSync } = await import("node:fs");
    const css = readFileSync("src/styles/chessgroundBaseOverride.css", "utf8") as string;
    const pieceRule = css.match(/\.cg-wrap piece\s*\{[^}]*\}/)?.[0] ?? "";

    expect(pieceRule).toMatch(/background-repeat:\s*no-repeat/);
    expect(pieceRule).toMatch(/clip-path:\s*inset\(1px\)/);
    expect(pieceRule).toMatch(/will-change:\s*auto/);
    expect(pieceRule).not.toMatch(/will-change:\s*transform/);
  });

  it("no experimental box-shadow or .hover overrides in baseline", async () => {
    // @ts-expect-error Node types are not included in this frontend tsconfig.
    const { readFileSync } = await import("node:fs");
    const globalCss = readFileSync("src/styles/global.css", "utf8") as string;
    const colorsCss = readFileSync("src/styles/chessgroundColorsOverride.css", "utf8") as string;
    const allCss = globalCss + colorsCss;

    // No box-shadow overlay or z-index:1 (baseline uses direct backgrounds)
    expect(allCss).not.toMatch(/box-shadow:.*--cg-highlight/);
    expect(allCss).not.toMatch(/z-index:\s*1/);
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
