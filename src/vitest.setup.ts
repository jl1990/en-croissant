// Provide localStorage mock for Node.js jsdom environments that lack --localstorage-file
if (typeof globalThis.localStorage === "undefined") {
    const store: Record<string, string> = {};
    (globalThis as any).localStorage = {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => {
            store[key] = String(value);
        },
        removeItem: (key: string) => {
            delete store[key];
        },
        clear: () => {
            Object.keys(store).forEach((k) => delete store[k]);
        },
        get length() {
            return Object.keys(store).length;
        },
        key: (index: number) => Object.keys(store)[index] ?? null,
    };
}
