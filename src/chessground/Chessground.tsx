import { Chessground as NativeChessground } from "@lichess-org/chessground";
import type { Api } from "@lichess-org/chessground/api";
import type { Config } from "@lichess-org/chessground/config";
import { Box } from "@mantine/core";
import deepEqual from "fast-deep-equal/es6";
import { useAtomValue } from "jotai";
import { memo, type Ref, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { useRenderTiming } from "@/utils/performance";
import { boardImageAtom, moveMethodAtom } from "@/state/atoms";

export const BOARD_COORDINATE_COLORS: Record<string, { white: string; black: string }> = {
  blue: { white: "#dee3e6", black: "#788a94" },
  blue2: { white: "#97b2c7", black: "#546f82" },
  blue3: { white: "#d9e0e6", black: "#315991" },
  "blue-marble": { white: "#eae6dd", black: "#7c7f87" },
  canvas2: { white: "#d7daeb", black: "#547388" },
  wood: { white: "#d8a45b", black: "#9b4d0f" },
  wood2: { white: "#a38b5d", black: "#6c5017" },
  wood3: { white: "#d0ceca", black: "#755839" },
  wood4: { white: "#caaf7d", black: "#7b5330" },
  maple: { white: "#e8ceab", black: "#bc7944" },
  maple2: { white: "#e2c89f", black: "#963" },
  leather: { white: "#d1d1c9", black: "#c28e16" },
  green: { white: "#ffd", black: "#6d8753" },
  brown: { white: "#f0d9b5", black: "#946f51" },
  "pink-pyramid": { white: "#e8e9b7", black: "#ed7272" },
  marble: { white: "#93ab91", black: "#4f644e" },
  "green-plastic": { white: "#f2f9bb", black: "#59935d" },
  grey: { white: "#b8b8b8", black: "#7d7d7d" },
  metal: { white: "#c9c9c9", black: "#727272" },
  olive: { white: "#b8b19f", black: "#6d6655" },
  newspaper: { white: "#fff", black: "#8d8d8d" },
  purple: { white: "#9f90b0", black: "#7d4a8d" },
  "purple-diag": { white: "#e5daf0", black: "#957ab0" },
  ic: { white: "#ececec", black: "#c1c18e" },
  horsey: { white: "#f0d9b5", black: "#946f51" },
  gray: { white: "#e9ecef", black: "#868e96" },
};

export function getBoardCoordinateColors(boardImage: string): {
  white: string;
  black: string;
} {
  const boardKey = boardImage.replace(/\.[^/.]+$/, "");
  return (
    BOARD_COORDINATE_COLORS[boardKey] ?? {
      white: "rgba(255, 255, 255, 0.8)",
      black: "rgba(72, 72, 72, 0.8)",
    }
  );
}

export interface ChessgroundRef {
  playPremove: () => boolean;
  cancelPremove: () => void;
}

/** Parse a CSS `url("...")` / `url(...)` value into the raw URL string. */
export function parseCssUrl(backgroundImage: string): string | null {
  const trimmed = backgroundImage.trim();
  if (!trimmed || trimmed === "none") return null;
  // Match url("..."), url('...'), or url(...)
  const match = trimmed.match(/^url\(["']?(.+?)["']?\)$/i);
  return match ? match[1] : null;
}

/** Build the drag overlay class list (piece classes minus dragging/drag-copy). */
export function getDragOverlayClassName(className: string): string {
  return className
    .split(/\s+/)
    .filter((classPart) => classPart && classPart !== "dragging" && classPart !== "drag-copy")
    .join(" ");
}

/** Read the SVG background-image URL for a piece class set by probing under cg-board. */
function readPieceSvgUrl(root: HTMLElement, pieceClassName: string): string | null {
  const board = root.querySelector("cg-board");
  if (!board) return null;
  const probe = document.createElement("piece");
  probe.className = pieceClassName;
  probe.setAttribute("aria-hidden", "true");
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  probe.style.width = "12.5%";
  probe.style.height = "12.5%";
  board.appendChild(probe);
  const bg = getComputedStyle(probe).backgroundImage;
  board.removeChild(probe);
  return parseCssUrl(bg);
}

function installDragPieceOverlay(root: HTMLElement): () => void {
  let overlay: HTMLImageElement | null = null;
  let lastSrc: string | null = null;
  let animationFrame = 0;

  const removeOverlay = () => {
    overlay?.remove();
    overlay = null;
    lastSrc = null;
    // Flush compositor after drag ends — WebKitGTK may not invalidate the
    // area where the dragging piece was hidden.
    flushCompositor();
  };

  const snap = (v: number) => Math.round(v * window.devicePixelRatio) / window.devicePixelRatio;

  /** WebKitGTK can leave stale compositor backing-store pixels after piece
      element removal (move animation end, drag end). Toggling will-change
      briefly destroys and recreates the compositing layer, forcing a clean
      repaint of the affected area. Throttled by RAF. */
  let flushPending = false;
  const flushCompositor = () => {
    if (flushPending) return;
    flushPending = true;
    const board = root.querySelector<HTMLElement>("cg-board");
    if (!board) return;
    board.style.willChange = "transform";
    requestAnimationFrame(() => {
      board.style.willChange = "";
      flushPending = false;
    });
  };

  let moveMutationPending = false;

  const updateOverlay = () => {
    animationFrame = 0;

    const draggingPiece = root.querySelector<HTMLElement>("cg-board piece.dragging");
    if (!draggingPiece) {
      removeOverlay();
      return;
    }

    const rootRect = root.getBoundingClientRect();
    const pieceRect = draggingPiece.getBoundingClientRect();

    if (!overlay) {
      overlay = document.createElement("img");
      overlay.className = "drag-copy";
      overlay.setAttribute("aria-hidden", "true");
      overlay.setAttribute("draggable", "false");
      root.appendChild(overlay);
    }

    const pieceClassName = getDragOverlayClassName(draggingPiece.className);
    const src = readPieceSvgUrl(root, pieceClassName);
    if (src && src !== lastSrc) {
      overlay.src = src;
      lastSrc = src;
    }

    const left = `${snap(pieceRect.left - rootRect.left)}px`;
    const top = `${snap(pieceRect.top - rootRect.top)}px`;
    const width = `${snap(pieceRect.width)}px`;
    const height = `${snap(pieceRect.height)}px`;

    if (overlay.style.left !== left) overlay.style.left = left;
    if (overlay.style.top !== top) overlay.style.top = top;
    if (overlay.style.width !== width) overlay.style.width = width;
    if (overlay.style.height !== height) overlay.style.height = height;
  };

  const requestUpdate = () => {
    if (!animationFrame) {
      animationFrame = window.requestAnimationFrame(updateOverlay);
    }
  };

  /** Detect when a piece move animation completes (fading elements
      removed) and flush the WebKitGTK compositor. */
  const onMutation: MutationCallback = (mutations) => {
    const hasFadingRemoval = mutations.some(
      (m) =>
        m.type === "childList" &&
        Array.from(m.removedNodes).some(
          (n) => n instanceof HTMLElement && n.classList?.contains("fading"),
        ),
    );
    if (hasFadingRemoval) {
      // Delay to let any remaining CSS transitions finish
      setTimeout(() => flushCompositor(), 300);
    }
    requestUpdate();
  };

  const observer = new MutationObserver(onMutation);
  observer.observe(root, {
    attributes: true,
    attributeFilter: ["class", "style"],
    childList: true,
    subtree: true,
  });

  window.addEventListener("pointermove", requestUpdate, true);
  window.addEventListener("mousemove", requestUpdate, true);
  window.addEventListener("touchmove", requestUpdate, true);
  window.addEventListener("pointerup", requestUpdate, true);
  window.addEventListener("mouseup", requestUpdate, true);
  window.addEventListener("touchend", requestUpdate, true);
  requestUpdate();

  return () => {
    observer.disconnect();
    window.removeEventListener("pointermove", requestUpdate, true);
    window.removeEventListener("mousemove", requestUpdate, true);
    window.removeEventListener("touchmove", requestUpdate, true);
    window.removeEventListener("pointerup", requestUpdate, true);
    window.removeEventListener("mouseup", requestUpdate, true);
    window.removeEventListener("touchend", requestUpdate, true);
    if (animationFrame) {
      window.cancelAnimationFrame(animationFrame);
    }
    removeOverlay();
  };
}

interface ChessgroundProps extends Config {
  setBoardFen?: (fen: string) => void;
}

function ChessgroundInner(props: ChessgroundProps & { ref?: Ref<ChessgroundRef> }) {
  const { ref } = props;
  useRenderTiming("Chessground");
  const apiRef = useRef<Api | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const lastConfigRef = useRef<Record<string, unknown>>({});
  const lastEventsRef = useRef(props.events);

  const moveMethod = useAtomValue(moveMethodAtom);

  useImperativeHandle(
    ref,
    () => ({
      playPremove: () => apiRef.current?.playPremove() ?? false,
      cancelPremove: () => apiRef.current?.cancelPremove(),
    }),
    [],
  );

  /** Keep latest props in a ref so the init effect can read fresh callbacks. */
  const propsRef = useRef(props);
  propsRef.current = props;

  /**
   * Merge moveMethod-driven drag/select defaults with parent-supplied draggable props
   * (e.g. deleteOnDropOff for editing mode).
   * moveMethod's enabled takes precedence over parent's draggable.enabled.
   */
  const mergedDraggable = useMemo(
    () => ({
      ...(props.draggable ?? {}),
      enabled: moveMethod !== "select",
    }),
    [moveMethod, props.draggable],
  );

  const mergedSelectable = useMemo(
    () => ({ enabled: moveMethod !== "drag" }),
    [moveMethod],
  );

  /**
   * Build the serializable config subset for change detection.
   * Includes drawable/selectable free-form fields so shape/handler changes
   * trigger reconfiguration.
   */
  const currentConfig = useMemo<Record<string, unknown>>(
    () => ({
      fen: props.fen,
      orientation: props.orientation,
      lastMove: props.lastMove,
      turnColor: props.turnColor,
      coordinates: props.coordinates,
      coordinatesOnSquares: props.coordinatesOnSquares,
      check: props.check,
      movable: props.movable,
      drawable: props.drawable,
      highlight: props.highlight,
      events: props.events,
      premovable: props.premovable,
      animation: props.animation,
      draggable: mergedDraggable,
      selectable: mergedSelectable,
    }),
    [
      props.fen,
      props.orientation,
      props.lastMove,
      props.turnColor,
      props.coordinates,
      props.coordinatesOnSquares,
      props.check,
      props.movable,
      props.drawable,
      props.highlight,
      props.events,
      props.premovable,
      props.animation,
      mergedDraggable,
      mergedSelectable,
    ],
  );

  // Initialize chessground once
  useEffect(() => {
    if (boardRef?.current == null || apiRef.current) return;

    const chessgroundApi = NativeChessground(boardRef.current, {
      ...propsRef.current,
      addDimensionsCssVarsTo: boardRef.current,
      events: {
        ...propsRef.current.events,
        change: () => {
          const p = propsRef.current;
          if (p.setBoardFen && apiRef.current) {
            p.setBoardFen(apiRef.current.getFen());
          }
        },
      },
      draggable: mergedDraggable,
      selectable: mergedSelectable,
    });

    apiRef.current = chessgroundApi;
    lastConfigRef.current = currentConfig;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const root = boardRef.current;
    if (!root) return;

    return installDragPieceOverlay(root);
  }, []);

  // Update config when it changes, using deep equality that handles Maps, Sets, and objects
  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;

    const configChanged = !deepEqual(currentConfig, lastConfigRef.current);
    const eventsChanged = props.events !== lastEventsRef.current;

    if (!configChanged && !eventsChanged) {
      return;
    }

    if (configChanged) {
      lastConfigRef.current = currentConfig;
    }
    if (eventsChanged) {
      lastEventsRef.current = props.events;
    }

    // Only call api.set when something meaningful changed
    api.set({
      ...props,
      draggable: mergedDraggable,
      selectable: mergedSelectable,
    });
  }, [currentConfig, props, mergedDraggable, mergedSelectable]); // eslint-disable-line react-hooks/exhaustive-deps

  const boardImage = useAtomValue(boardImageAtom);
  const boardCoordColors = getBoardCoordinateColors(boardImage);

  return (
    <Box
      style={{
        aspectRatio: 1,
        width: "100%",
        "--board-image": `url('/board/${boardImage}')`,
        "--board-coord-color-white": boardCoordColors.white,
        "--board-coord-color-black": boardCoordColors.black,
      }}
      ref={boardRef}
    />
  );
}

const Chessground = memo(ChessgroundInner);
export { Chessground };
export type { ChessgroundProps };
