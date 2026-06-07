import { nowIso } from "../utils.js";

export function createEventBus() {
  const listeners = new Set();

  function emit(event) {
    const payload = {
      id: `${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      at: nowIso(),
      ...event
    };
    for (const listener of listeners) {
      listener(payload);
    }
    return payload;
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return {
    emit,
    subscribe
  };
}
