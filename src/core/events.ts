/** Minimal typed event bus used to decouple simulation from UI/audio. */
export type Handler<T> = (payload: T) => void;

export class EventBus<Events extends Record<string, unknown>> {
  private handlers: { [K in keyof Events]?: Set<Handler<Events[K]>> } = {};

  on<K extends keyof Events>(type: K, h: Handler<Events[K]>): () => void {
    (this.handlers[type] ??= new Set()).add(h);
    return () => this.handlers[type]?.delete(h);
  }

  emit<K extends keyof Events>(type: K, payload: Events[K]): void {
    const set = this.handlers[type];
    if (!set) return;
    for (const h of set) {
      try {
        h(payload);
      } catch (e) {
        console.error(`event handler for ${String(type)} failed`, e);
      }
    }
  }

  clear(): void {
    this.handlers = {};
  }
}
