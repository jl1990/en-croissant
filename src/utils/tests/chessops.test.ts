import { parseSquare } from "chessops";
import { parseFen } from "chessops/fen";
import { expect, test } from "vitest";
import { computeEngineKeys } from "@/state/atoms";
import { getCastlingSquare } from "../chessops";

test("should get the correct castling square in the starting position", () => {
    const setup = parseFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1").unwrap();
    expect(getCastlingSquare(setup, "w", "k")).toBe(parseSquare("h1"));
    expect(getCastlingSquare(setup, "w", "q")).toBe(parseSquare("a1"));
    expect(getCastlingSquare(setup, "b", "k")).toBe(parseSquare("h8"));
    expect(getCastlingSquare(setup, "b", "q")).toBe(parseSquare("a8"));
});

test("should get the correct castling square in FRC 1", () => {
    const setup = parseFen("bbqnnrkr/pppppppp/8/8/8/8/PPPPPPPP/BBQNNRKR w KQkq - 0 1").unwrap();
    expect(getCastlingSquare(setup, "w", "k")).toBe(parseSquare("h1"));
    expect(getCastlingSquare(setup, "w", "q")).toBe(parseSquare("f1"));
    expect(getCastlingSquare(setup, "b", "k")).toBe(parseSquare("h8"));
    expect(getCastlingSquare(setup, "b", "q")).toBe(parseSquare("f8"));
});

test("should get the correct castling square in FRC 500", () => {
    const setup = parseFen("brqnknrb/pppppppp/8/8/8/8/PPPPPPPP/BRQNKNRB w KQkq - 0 1").unwrap();
    expect(getCastlingSquare(setup, "w", "k")).toBe(parseSquare("g1"));
    expect(getCastlingSquare(setup, "w", "q")).toBe(parseSquare("b1"));
    expect(getCastlingSquare(setup, "b", "k")).toBe(parseSquare("g8"));
    expect(getCastlingSquare(setup, "b", "q")).toBe(parseSquare("b8"));
});

test("should get the correct castling square in FRC 600", () => {
    const setup = parseFen("rqbnkrnb/pppppppp/8/8/8/8/PPPPPPPP/RQBNKRNB w KQkq - 0 1").unwrap();
    expect(getCastlingSquare(setup, "w", "k")).toBe(parseSquare("f1"));
    expect(getCastlingSquare(setup, "w", "q")).toBe(parseSquare("a1"));
    expect(getCastlingSquare(setup, "b", "k")).toBe(parseSquare("f8"));
    expect(getCastlingSquare(setup, "b", "q")).toBe(parseSquare("a8"));
});

test("computeEngineKeys should return correct keys for starting position with no moves", () => {
    const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const [swapKey, fullKey, turn] = computeEngineKeys(fen, []);
    expect(turn).toBe("white");
    expect(swapKey).not.toBe(fen);
    // fullKey for empty moves appends ":" to the fen
    expect(fullKey).toBe(fen + ":");
});

test("computeEngineKeys should return correct keys for a position with one move", () => {
    const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const [, fullKey, turn] = computeEngineKeys(fen, ["e2e4"]);
    expect(turn).toBe("black");
    expect(fullKey).toBe("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1:e2e4");
});

test("computeEngineKeys should return correct turn for a position after a move", () => {
    const fen = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
    const [, , turn] = computeEngineKeys(fen, []);
    expect(turn).toBe("black");
});

test("computeEngineKeys should detect ended positions (checkmate)", () => {
    // Fool's mate position (white is checkmated)
    const checkmateFen = "rnb1kbnr/pppp1ppp/8/4p3/5PPq/8/PPPPP2P/RNBQKBNR w KQkq - 1 3";
    const [swapKey, fullKey, turn] = computeEngineKeys(checkmateFen, []);
    expect(turn).toBe("white");
    // Ended positions skip swapMove, so swapKey equals the original fen
    expect(swapKey).toBe(checkmateFen);
    expect(fullKey).toBe(checkmateFen);
});

test("should get the correct castling square in FRC 608", () => {
    const setup = parseFen("rqnkrnbb/pppppppp/8/8/8/8/PPPPPPPP/RQNKRNBB w EAea - 0 1").unwrap();
    expect(getCastlingSquare(setup, "w", "k")).toBe(parseSquare("e1"));
    expect(getCastlingSquare(setup, "w", "q")).toBe(parseSquare("a1"));
    expect(getCastlingSquare(setup, "b", "k")).toBe(parseSquare("e8"));
    expect(getCastlingSquare(setup, "b", "q")).toBe(parseSquare("a8"));
});
