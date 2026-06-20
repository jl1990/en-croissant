/**
 * Lightweight performance instrumentation for development only.
 * Completely eliminated by bundler in production builds.
 * Enable with localStorage.setItem('ec-profile', '1').
 */

import { useEffect, useRef } from "react";

const PROFILING_KEY = "ec-profile";

function isProfilingEnabled(): boolean {
    if (typeof localStorage === "undefined") return false;
    try {
        return localStorage.getItem(PROFILING_KEY) === "1";
    } catch {
        return false;
    }
}

function shouldProfile(): boolean {
    return import.meta.env.DEV && isProfilingEnabled();
}

// Null hook — completely static, no runtime allocations, eliminated by DCE
const NOOP = () => {};

/**
 * Log a render count + timing for a named component.
 * Use: `useRenderTiming("Board")` at top of component body.
 * True no-op (no hooks called) in production or when profiling is disabled.
 */
export const useRenderTiming: (name: string) => void = shouldProfile()
    ? (name: string) => {
        const renderCount = useRef(0);
        const startTime = useRef(performance.now());

        renderCount.current++;

        useEffect(() => {
            const elapsed = performance.now() - startTime.current;
            if (renderCount.current <= 5 || renderCount.current % 10 === 0) {
                console.log(
                    `[perf] ${name} render #${renderCount.current} (commit: ${elapsed.toFixed(1)}ms)`,
                );
            }
        });

        useEffect(() => {
            renderCount.current = 0;
            startTime.current = performance.now();
        }, []);
    }
    : NOOP;

/**
 * Mark a phase in performance timeline.
 * Use: `markPerf("search started")`.
 * No-op in production or when profiling is disabled.
 */
export const markPerf: (label: string) => void = shouldProfile()
    ? (label: string) => {
        performance.mark(label);
    }
    : NOOP;

/**
 * Measure between two marks and log the duration.
 */
export function measurePerf(startLabel: string, endLabel: string, measureLabel: string) {
    if (!shouldProfile()) return;
    try {
        performance.measure(measureLabel, startLabel, endLabel);
        const entries = performance.getEntriesByName(measureLabel);
        if (entries.length > 0) {
            const duration = entries[entries.length - 1].duration;
            if (duration > 16) {
                console.warn(`[perf] ${measureLabel}: ${duration.toFixed(1)}ms (exceeds frame budget)`);
            }
        }
    } catch {
        // marks may not exist if profiling was just toggled
    }
}

/**
 * Enable profiling by setting localStorage item.
 */
export function enableProfiling() {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(PROFILING_KEY, "1");
    console.log("[perf] Profiling enabled. Refresh to start collecting marks.");
}

/**
 * Disable profiling and clear collected marks.
 */
export function disableProfiling() {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(PROFILING_KEY);
    performance.clearMarks();
    performance.clearMeasures();
    console.log("[perf] Profiling disabled.");
}
