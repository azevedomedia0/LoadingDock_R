declare module "electrobun/view" {
  export class Electroview {
    shell?: { openExternal(url: string): void };
    /** Pass `{} as any` — electrobun ≥1.18 requires a config object. */
    constructor(config: unknown);
    /** Polyfilled: register a handler for messages arriving from the main process. */
    on(name: string, handler: (message: any) => void): void;
    /** Polyfilled: send a message to the main process. */
    send(name: string, payload: unknown): void;
    /** Low-level: send raw JSON string via WebSocket / postMessage bridge. */
    bunBridge(msg: string): Promise<void>;
    /** Low-level: called by the native layer when a message arrives from bun. */
    rpcHandler?: (msg: unknown) => void;
  }
}
