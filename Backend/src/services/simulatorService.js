export function createSimulatorService({ store, cpoService, eventBus }) {
  const timers = new Map();

  async function start(cpoId) {
    const cpo = store.getCpoById(cpoId);
    if (!cpo) {
      const error = new Error("CPO not found");
      error.status = 404;
      throw error;
    }
    if (timers.has(cpoId)) {
      return { status: "already_running" };
    }

    await store.updateCpo(cpoId, { simulatorStatus: "running" });
    const timer = setInterval(async () => {
      try {
        const latest = store.getCpoById(cpoId);
        if (!latest) {
          clearInterval(timer);
          timers.delete(cpoId);
          return;
        }
        const event = cpoService.generateRandomConnectorStatusPayload(latest);
        if (!event) {
          return;
        }
        await cpoService.dispatchEvent(cpoId, event.eventType, event.payload, {
          source: "simulator"
        });
      } catch (error) {
        eventBus.emit({
          scope: "SIMULATOR_ERROR",
          cpoId,
          payload: { message: error.message }
        });
      }
    }, 3000);

    timers.set(cpoId, timer);
    eventBus.emit({
      scope: "SIMULATOR_STATUS",
      cpoId,
      payload: { status: "running" }
    });

    return { status: "running" };
  }

  async function stop(cpoId) {
    const timer = timers.get(cpoId);
    if (timer) {
      clearInterval(timer);
      timers.delete(cpoId);
    }
    await store.updateCpo(cpoId, { simulatorStatus: "stopped" });
    eventBus.emit({
      scope: "SIMULATOR_STATUS",
      cpoId,
      payload: { status: "stopped" }
    });
    return { status: "stopped" };
  }

  async function stopAll() {
    for (const [cpoId, timer] of timers.entries()) {
      clearInterval(timer);
      timers.delete(cpoId);
      await store.updateCpo(cpoId, { simulatorStatus: "stopped" });
    }
  }

  return { start, stop, stopAll };
}
