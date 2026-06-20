/**
 * Isolated clock store for game mode, keyed by gameId.
 *
 * Stores clock times per active game so that switching between tabs/games
 * never shows stale clock values. Consumers select by `liveClockGameId`
 * to get the correct game's times.
 */

import { createStore, useStore } from "zustand";

interface ClockEntry {
    whiteTime: number | null;
    blackTime: number | null;
}

interface ClockState {
    timesByGameId: Record<string, ClockEntry>;
}

interface ClockActions {
    /** Set clock times for a specific game. Always stores — never rejects. */
    setTimes: (gameId: string, whiteTime: number | null, blackTime: number | null) => void;
    /** Remove clock entry for a game. */
    clearGame: (gameId: string) => void;
    /** Clear all clock state. */
    reset: () => void;
}

type ClockStore = ClockState & ClockActions;

const initialState: ClockState = {
    timesByGameId: {},
};

export const clockStore = createStore<ClockStore>((set) => ({
    ...initialState,
    setTimes: (gameId, whiteTime, blackTime) =>
        set((state) => ({
            timesByGameId: {
                ...state.timesByGameId,
                [gameId]: { whiteTime, blackTime },
            },
        })),
    clearGame: (gameId) =>
        set((state) => {
            const { [gameId]: _, ...rest } = state.timesByGameId;
            return { timesByGameId: rest };
        }),
    reset: () => set(initialState),
}));

export function useClockStore<T>(selector: (state: ClockStore) => T): T {
    return useStore(clockStore, selector);
}
