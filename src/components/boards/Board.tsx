import type { DrawBrushes, DrawShape } from "@lichess-org/chessground/draw";
import { ActionIcon, Box, Center, Group, Text, useMantineTheme } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconChevronRight } from "@tabler/icons-react";
import {
  makeSquare,
  makeUci,
  type NormalMove,
  type Piece,
  parseSquare,
  parseUci,
  type SquareName,
} from "chessops";
import { chessgroundDests, chessgroundMove } from "chessops/compat";
import { makeFen, parseFen } from "chessops/fen";
import { makeSan } from "chessops/san";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";
import { useStore } from "zustand";
import { clockStore } from "@/state/clockStore";
import { useShallow } from "zustand/react/shallow";
import { Chessground, type ChessgroundRef } from "@/chessground/Chessground";
import {
  autoPromoteAtom,
  bestMovesFamily,
  currentEvalOpenAtom,
  currentShowCommentsAtom,
  currentTabAtom,
  deckAtomFamily,
  enableBoardScrollAtom,
  eraseDrawablesOnClickAtom,
  forcedEnPassantAtom,
  materialDisplayAtom,
  moveHighlightAtom,
  moveInputAtom,
  practiceCardStartTimeAtom,
  practiceSessionStatsAtom,
  practiceStateAtom,
  showArrowsAtom,
  showConsecutiveArrowsAtom,
  showCoordinatesAtom,
  showDestsAtom,
  showVariationArrowsAtom,
  snapArrowsAtom,
} from "@/state/atoms";

import { keyMapAtom } from "@/state/keybinds";
import classes from "@/styles/Chessboard.module.css";
import { ANNOTATION_INFO, isBasicAnnotation } from "@/utils/annotation";
import { getVariationLine } from "@/utils/chess";
import { chessopsError, forceEnPassant, positionFromFen } from "@/utils/chessops";
import { getTabFile, getTabGameNumber } from "@/utils/tabs";
import ShowMaterial from "../common/ShowMaterial";
import { TreeStateContext } from "../common/TreeStateContext";
import { useRenderTiming } from "@/utils/performance";
import FideInfo from "../databases/FideInfo";
import { updateCardPerformance } from "../files/opening";
import { arrowColors } from "../panels/analysis/BestMoves";
import AnnotationHint from "./AnnotationHint";
import { BoardBar } from "./BoardBar";
import Clock from "./Clock";
import EvalBar from "./EvalBar";
import MoveInput from "./MoveInput";
import PromotionModal from "./PromotionModal";

const LARGE_BRUSH = 11;
const MEDIUM_BRUSH = 7.5;
const SMALL_BRUSH = 4;
const BAR_HEIGHT = "1.9rem";

interface ChessboardProps {
  editingMode: boolean;
  viewOnly?: boolean;
  disableVariations?: boolean;
  movable?: "both" | "white" | "black" | "turn" | "none";
  boardRef: React.MutableRefObject<HTMLDivElement | null>;
  practicing?: boolean;
  selectedPiece?: Piece | null;
  onMove?: (uci: string) => void;
  cgRef?: React.Ref<ChessgroundRef>;
  enablePremoves?: boolean;
  liveClockGameId?: string;
}

function Board({
  editingMode,
  viewOnly,
  disableVariations,
  movable = "turn",
  boardRef,
  practicing,
  selectedPiece,
  onMove,
  cgRef,
  enablePremoves = false,
  liveClockGameId,
}: ChessboardProps) {
  useRenderTiming("Board");
  const { t } = useTranslation();

  const store = useContext(TreeStateContext)!;
  const clockStoreRef = useRef(clockStore.getState());

  // Sync clock state to ref without triggering re-renders
  useEffect(() => {
    const unsub = clockStore.subscribe((s) => {
      clockStoreRef.current = s;
    });
    return unsub;
  }, []);

  const root = useStore(store, (s) => s.root);
  const rootFen = useStore(store, (s) => s.root.fen);
  const moves = useStore(
    store,
    useShallow((s) => getVariationLine(s.root, s.position)),
  );
  const headers = useStore(store, (s) => s.headers);
  const currentNode = useStore(store, (s) => s.currentNode());

  const arrows = useAtomValue(
    bestMovesFamily({
      fen: rootFen,
      gameMoves: moves,
    }),
  );

  const goToNext = useStore(store, (s) => s.goToNext);
  const goToPrevious = useStore(store, (s) => s.goToPrevious);
  const storeMakeMove = useStore(store, (s) => s.makeMove);
  const setHeaders = useStore(store, (s) => s.setHeaders);
  const clearShapes = useStore(store, (s) => s.clearShapes);
  const setShapes = useStore(store, (s) => s.setShapes);
  const setFen = useStore(store, (s) => s.setFen);

  const [pos, error] = useMemo(() => positionFromFen(currentNode.fen), [currentNode.fen]);
  const [whiteFideOpen, setWhiteFideOpen] = useState(false);
  const [blackFideOpen, setBlackFideOpen] = useState(false);

  const moveInput = useAtomValue(moveInputAtom);
  const showDests = useAtomValue(showDestsAtom);
  const moveHighlight = useAtomValue(moveHighlightAtom);
  const showArrows = useAtomValue(showArrowsAtom);
  const showVariationArrows = useAtomValue(showVariationArrowsAtom);
  const showConsecutiveArrows = useAtomValue(showConsecutiveArrowsAtom);
  const eraseDrawablesOnClick = useAtomValue(eraseDrawablesOnClickAtom);
  const autoPromote = useAtomValue(autoPromoteAtom);
  const forcedEP = useAtomValue(forcedEnPassantAtom);
  const showCoordinates = useAtomValue(showCoordinatesAtom);
  const materialDisplay = useAtomValue(materialDisplayAtom);

  const dests = useMemo(() => {
    if (!pos) return new Map<SquareName, SquareName[]>();
    const d = chessgroundDests(pos);
    if (forcedEP) {
      return forceEnPassant(d, pos);
    }
    return d;
  }, [pos, forcedEP]);

  const [pendingMove, setPendingMove] = useState<NormalMove | null>(null);

  const turn = pos?.turn || "white";
  const orientation = headers.orientation || "white";
  const toggleOrientation = () =>
    setHeaders({
      ...headers,
      fen: root.fen,
      orientation: orientation === "black" ? "white" : "black",
    });

  const keyMap = useAtomValue(keyMapAtom);
  useHotkeys(keyMap.SWAP_ORIENTATION.keys, () => toggleOrientation());
  const currentTab = useAtomValue(currentTabAtom);
  const tabFile = getTabFile(currentTab);
  const [evalOpen, setEvalOpen] = useAtom(currentEvalOpenAtom);

  const [deck, setDeck] = useAtom(
    deckAtomFamily({
      file: tabFile?.path || "",
      game: getTabGameNumber(currentTab),
    }),
  );

  const setPracticeState = useSetAtom(practiceStateAtom);
  const [sessionStats, setSessionStats] = useAtom(practiceSessionStatsAtom);
  const cardStartTime = useAtomValue(practiceCardStartTimeAtom);

  const makeMove = useCallback(async (move: NormalMove) => {
    if (!pos) return;
    const san = makeSan(pos, move);
    if (practicing) {
      const c = deck.positions.find((c) => c.fen === currentNode.fen);
      if (!c) {
        return;
      }

      const i = deck.positions.indexOf(c);
      const timeTaken = Date.now() - cardStartTime;

      if (san !== c.answer) {
        if (sessionStats.mode !== "full") {
          updateCardPerformance(setDeck, i, c.card, 1);
        }
        setPracticeState({
          phase: "incorrect",
          currentFen: c.fen,
          answer: c.answer,
          playedMove: san,
          positionIndex: i,
          timeTaken,
        });
        setSessionStats((prev) => ({
          ...prev,
          incorrect: prev.incorrect + 1,
          streak: 0,
        }));
        notifications.show({
          title: t("Common.Incorrect"),
          message: t("Board.Practice.CorrectMoveWas", { move: c.answer }),
          color: "red",
        });
        await new Promise((resolve) => setTimeout(resolve, 500));
        goToNext();
      } else {
        storeMakeMove({
          payload: move,
        });
        setPendingMove(null);
        setPracticeState({
          phase: "correct",
          currentFen: c.fen,
          answer: c.answer,
          positionIndex: i,
          timeTaken,
        });
      }
    } else {
      const gameTimes = liveClockGameId
        ? clockStoreRef.current.timesByGameId[liveClockGameId]
        : undefined;
      const clockTimeForMove = gameTimes
        ? pos.turn === "white"
          ? gameTimes.whiteTime ?? undefined
          : gameTimes.blackTime ?? undefined
        : undefined;
      storeMakeMove({
        payload: move,
        clock: clockTimeForMove,
      });
      setPendingMove(null);

      if (onMove) {
        onMove(makeUci(move));
      }
    }
  }, [pos, practicing, deck, currentNode, cardStartTime, sessionStats, setPracticeState, setSessionStats, setDeck, goToNext, storeMakeMove, liveClockGameId, onMove, t]);

  const shapes = useMemo(() => {
    const result: DrawShape[] = [];
    // Track seen (orig,dest) pairs for O(1) duplicate lookup
    const seen = new Set<string>();
    const addIfNew = (s: DrawShape) => {
      const key = `${s.orig}:${s.dest}`;
      if (seen.has(key)) return;
      seen.add(key);
      result.push(s);
    };

    if (showArrows && evalOpen && arrows.size > 0 && pos) {
      const entries = Array.from(arrows.entries()).sort((a, b) => a[0] - b[0]);
      for (const [i, moves] of entries) {
        if (i < 4) {
          const bestWinChance = moves[0].winChance;
          for (const [j, { pv, winChance }] of moves.entries()) {
            const posClone = pos.clone();
            let prevSquare: string | null = null;
            for (const [ii, uci] of pv.entries()) {
              const m = parseUci(uci)! as NormalMove;

              posClone.play(m);
              const from = makeSquare(m.from)!;
              const to = makeSquare(m.to)!;
              if (prevSquare === null) {
                prevSquare = from;
              }
              const brushSize = match(bestWinChance - winChance)
                .when(
                  (d) => d < 2.5,
                  () => LARGE_BRUSH,
                )
                .when(
                  (d) => d < 5,
                  () => MEDIUM_BRUSH,
                )
                .otherwise(() => SMALL_BRUSH);

              if (ii === 0 || (showConsecutiveArrows && j === 0 && ii % 2 === 0)) {
                if (
                  ii < 5 && // max 3 arrows
                  !seen.has(`${from}:${to}`) &&
                  prevSquare === from
                ) {
                  addIfNew({
                    orig: from,
                    dest: to,
                    brush: j === 0 ? arrowColors[i].strong : arrowColors[i].pale,
                    modifiers: {
                      lineWidth: brushSize,
                    },
                  });
                  prevSquare = to;
                } else {
                  break;
                }
              }
            }
          }
        }
      }
    }

    // Variation arrows: show all children moves when there are alternatives
    if (showVariationArrows && currentNode.children.length > 1) {
      for (const child of currentNode.children) {
        if (child.move) {
          const m = child.move as NormalMove;
          const from = makeSquare(m.from);
          const to = makeSquare(m.to);
          if (from && to) {
            addIfNew({
              orig: from,
              dest: to,
              brush: "variation",
              modifiers: {
                lineWidth: MEDIUM_BRUSH,
              },
            });
          }
        }
      }
    }

    if (currentNode.shapes.length > 0) {
      for (const s of currentNode.shapes) {
        addIfNew(s);
      }
    }

    return result;
  }, [showArrows, evalOpen, arrows, pos, showConsecutiveArrows, showVariationArrows, currentNode.children, currentNode.shapes]);

  const hasClock =
    !!liveClockGameId ||
    !!headers.time_control ||
    !!headers.white_time_control ||
    !!headers.black_time_control;

  const practiceLock = !!practicing && !deck.positions.find((c) => c.fen === currentNode.fen);

  const movableColor: "white" | "black" | "both" | undefined = useMemo(() => {
    return practiceLock
      ? undefined
      : editingMode
        ? "both"
        : match(movable)
            .with("white", () => "white" as const)
            .with("black", () => "black" as const)
            .with("turn", () => turn)
            .with("both", () => "both" as const)
            .with("none", () => undefined)
            .exhaustive();
  }, [practiceLock, editingMode, movable, turn]);

  const theme = useMantineTheme();
  const color = ANNOTATION_INFO[currentNode.annotations[0]]?.color || "gray";
  const lightColor = theme.colors[color][6];
  const darkColor = theme.colors[color][8];

  const [enableBoardScroll] = useAtom(enableBoardScrollAtom);
  const [snapArrows] = useAtom(snapArrowsAtom);
  const showComments = useAtomValue(currentShowCommentsAtom);
  const visualAnnotation = showComments ? currentNode.annotations[0] : "";

  const setBoardFen = useCallback(
    (fen: string) => {
      if (!fen || !editingMode) {
        return;
      }
      const newFen = `${fen} ${currentNode.fen.split(" ").slice(1).join(" ")}`;

      if (newFen !== currentNode.fen) {
        setFen(newFen);
      }
    },
    [editingMode, currentNode, setFen],
  );

  useHotkeys(keyMap.TOGGLE_EVAL_BAR.keys, () => setEvalOpen((e) => !e));

  const square = useMemo(
    () =>
      match(currentNode)
        .with({ san: "O-O" }, ({ halfMoves }) => parseSquare(halfMoves % 2 === 1 ? "g1" : "g8"))
        .with({ san: "O-O-O" }, ({ halfMoves }) => parseSquare(halfMoves % 2 === 1 ? "c1" : "c8"))
        .otherwise((node) => node.move?.to),
    [currentNode],
  );

  const lastMove = useMemo(
    () =>
      currentNode.move && square !== undefined
        ? [chessgroundMove(currentNode.move)[0], makeSquare(square)!]
        : undefined,
    [currentNode.move, square],
  );

  const topPlayer = orientation === "white" ? headers.black : headers.white;
  const bottomPlayer = orientation === "white" ? headers.white : headers.black;

  // Memoize Chessground config objects to stabilize references
  const movableEventsAfter = useCallback(
    (orig: string, dest: string, metadata: { ctrlKey?: boolean }) => {
      if (!editingMode && pos) {
        const from = parseSquare(orig)!;
        const to = parseSquare(dest)!;
        if (
          pos.board.get(from)?.role === "pawn" &&
          ((dest[1] === "8" && turn === "white") || (dest[1] === "1" && turn === "black"))
        ) {
          if (autoPromote && !metadata.ctrlKey) {
            makeMove({ from, to, promotion: "queen" });
          } else {
            setPendingMove({ from, to });
          }
        } else {
          makeMove({ from, to });
        }
      }
    },
    [editingMode, pos, turn, autoPromote, makeMove],
  );

  const movableConfig = useMemo(
    () => ({
      free: editingMode,
      color: movableColor,
      dests:
        editingMode || viewOnly
          ? undefined
          : disableVariations && currentNode.children.length > 0
            ? undefined
            : dests,
      showDests,
      events: {
        after: movableEventsAfter,
      },
    }),
    [editingMode, movableColor, viewOnly, disableVariations, currentNode.children.length, dests, showDests, movableEventsAfter],
  );

  const selectEvent = useCallback(
    (key: string) => {
      if (editingMode && selectedPiece) {
        const square = parseSquare(key);
        if (square) {
          const setup = parseFen(currentNode.fen).unwrap();
          setup.board.set(square, selectedPiece);
          setFen(makeFen(setup));
        }
      }
    },
    [editingMode, selectedPiece, currentNode.fen, setFen],
  );

  const eventsConfig = useMemo(() => ({ select: selectEvent }), [selectEvent]);

  const premovableConfig = useMemo(
    () => ({
      enabled: enablePremoves && !editingMode && !viewOnly,
    }),
    [enablePremoves, editingMode, viewOnly],
  );

  const draggableConfig = useMemo(
    () => ({
      enabled: true,
      deleteOnDropOff: editingMode,
    }),
    [editingMode],
  );

  const animationConfig = useMemo(() => ({ enabled: !editingMode }), [editingMode]);

  const drawableOnChange = useCallback(
    (s: DrawShape[]) => {
      setShapes(s);
    },
    [setShapes],
  );

  const drawableConfig = useMemo(
    () => ({
      enabled: true,
      visible: true,
      defaultSnapToValidMove: snapArrows,
      autoShapes: shapes,
      brushes: {
        variation: {
          key: "v",
          color: "#9b59b6",
          opacity: 0.8,
          lineWidth: 10,
        },
      } as unknown as DrawBrushes,
      onChange: drawableOnChange,
    }),
    [snapArrows, shapes, drawableOnChange],
  );

  return (
    <>
      <Box w="100%" h="100%">
        <Box
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            height: "100%",
            gap: "0.5rem",
            flexWrap: "nowrap",
            overflow: "hidden",
            maxWidth:
              //            topbar   bottompadding                tabs                                  bottomb    topbar   evalbar                                gaps    ???
              `calc(100vh - 2.25rem - var(--mantine-spacing-sm) - 2.5rem - var(--mantine-spacing-sm) - ${BAR_HEIGHT} - ${BAR_HEIGHT} + 1.563rem + var(--mantine-spacing-md) - 1rem  - 0.2rem)`,
          }}
        >
          <BoardBar
            name={topPlayer}
            rating={orientation === "white" ? headers.black_elo : headers.white_elo}
            onNameClick={() => {
              if (orientation === "white") {
                setBlackFideOpen(true);
              } else {
                setWhiteFideOpen(true);
              }
            }}
            height={BAR_HEIGHT}
          >
            <ShowMaterial
              fen={currentNode.fen}
              color={orientation === "white" ? "black" : "white"}
              mode={materialDisplay}
            />
            {hasClock && (
              <Clock
                color={orientation === "black" ? "white" : "black"}
                turn={turn}
                liveClockGameId={liveClockGameId}
              />
            )}
          </BoardBar>
          <Group
            style={{
              position: "relative",
              flexWrap: "nowrap",
            }}
            gap="sm"
          >
            {showComments &&
              currentNode.annotations.length > 0 &&
              currentNode.move &&
              square !== undefined && (
                <Box pl="2.5rem" w="100%" h="100%" pos="absolute">
                  <Box pos="relative" w="100%" h="100%">
                    <AnnotationHint
                      orientation={orientation}
                      square={square}
                      annotation={currentNode.annotations[0]}
                    />
                  </Box>
                </Box>
              )}
            <Box
              h="100%"
              style={{
                width: 25,
              }}
            >
              {!evalOpen && (
                <Center h="100%" w="100%">
                  <ActionIcon
                    size="1rem"
                    onClick={() => setEvalOpen(true)}
                    onContextMenu={(e) => {
                      setEvalOpen(true);
                      e.preventDefault();
                    }}
                  >
                    <IconChevronRight />
                  </ActionIcon>
                </Center>
              )}
              {evalOpen && <EvalBar score={currentNode.score || null} orientation={orientation} />}
            </Box>
            <Box
              style={
                isBasicAnnotation(visualAnnotation)
                  ? {
                      "--light-color": lightColor,
                      "--dark-color": darkColor,
                    }
                  : undefined
              }
              className={classes.chessboard}
              ref={boardRef}
              onClick={() => {
                eraseDrawablesOnClick && clearShapes();
              }}
              onWheel={(e) => {
                if (enableBoardScroll) {
                  if (e.deltaY > 0) {
                    goToNext();
                  } else {
                    goToPrevious();
                  }
                }
              }}
            >
              <PromotionModal
                pendingMove={pendingMove}
                cancelMove={() => setPendingMove(null)}
                confirmMove={(p) => {
                  if (pendingMove) {
                    makeMove({
                      from: pendingMove.from,
                      to: pendingMove.to,
                      promotion: p,
                    });
                  }
                }}
                turn={turn}
                orientation={orientation}
              />

              <Chessground
                ref={cgRef}
                setBoardFen={setBoardFen}
                orientation={orientation}
                fen={currentNode.fen}
                animation={animationConfig}
                coordinates={showCoordinates !== "no"}
                coordinatesOnSquares={showCoordinates === "all"}
                movable={movableConfig}
                events={eventsConfig}
                turnColor={turn}
                check={moveHighlight && pos?.isCheck()}
                lastMove={moveHighlight && !editingMode ? lastMove : undefined}
                premovable={premovableConfig}
                draggable={draggableConfig}
                drawable={drawableConfig}
              />
            </Box>
          </Group>
          <BoardBar
            name={bottomPlayer}
            rating={orientation === "white" ? headers.white_elo : headers.black_elo}
            onNameClick={() => {
              if (orientation === "white") {
                setWhiteFideOpen(true);
              } else {
                setBlackFideOpen(true);
              }
            }}
            height={BAR_HEIGHT}
          >
            {error && (
              <Text ta="center" c="red">
                {t(chessopsError(error))}
              </Text>
            )}

            {moveInput && <MoveInput currentNode={currentNode} />}

            <ShowMaterial fen={currentNode.fen} color={orientation} mode={materialDisplay} />
            {hasClock && (
              <Clock color={orientation} turn={turn} liveClockGameId={liveClockGameId} />
            )}
          </BoardBar>
        </Box>
      </Box>
      <FideInfo opened={whiteFideOpen} setOpened={setWhiteFideOpen} name={headers.white} />
      <FideInfo opened={blackFideOpen} setOpened={setBlackFideOpen} name={headers.black} />
    </>
  );
}

export default memo(Board);
