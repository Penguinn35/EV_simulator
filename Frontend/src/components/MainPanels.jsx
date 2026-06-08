function countConnectors(station) {
  return station.chargingPoints.reduce(
    (total, chargePoint) => total + chargePoint.connectors.length,
    0
  );
}

export function StationsPanel({
  selectedCpo,
  pagedStations,
  page,
  pageCount,
  busyActions,
  onOpenCreateStation,
  onLoginAuth,
  onSimulator,
  onDeleteCpo,
  onSelectStation,
  onPageChange
}) {
  const isBusy = (key) => busyActions.has(key);
  const uiLocked = !selectedCpo || isBusy("load-cpos");

  return (
    <section className="stations-panel">
      <div className="toolbar">
        <h2>{selectedCpo ? `${selectedCpo.name} Stations` : "Select a CPO"}</h2>
        <div className="toolbar-actions">
          <button
            type="button"
            onClick={onOpenCreateStation}
            disabled={uiLocked || isBusy("create-station")}
          >
            {isBusy("create-station") ? "Adding..." : "Add Station"}
          </button>
          <button type="button" onClick={onLoginAuth} disabled={uiLocked || isBusy("login-auth")}>
            {isBusy("login-auth") ? "Logging in..." : "Login Auth"}
          </button>
          <button
            type="button"
            onClick={() => onSimulator("start")}
            disabled={uiLocked || isBusy("simulator-start")}
          >
            {isBusy("simulator-start") ? "Starting..." : "Start Simulator"}
          </button>
          <button
            type="button"
            onClick={() => onSimulator("stop")}
            disabled={uiLocked || isBusy("simulator-stop")}
          >
            {isBusy("simulator-stop") ? "Stopping..." : "Stop Simulator"}
          </button>
          <button
            type="button"
            className="danger"
            onClick={onDeleteCpo}
            disabled={uiLocked || isBusy("delete-cpo")}
          >
            {isBusy("delete-cpo") ? "Deleting..." : "Delete CPO"}
          </button>
        </div>
      </div>

      <div className="station-list">
        {pagedStations.map((station) => (
          <article className="station-card simple" key={station.id}>
            <div className="station-card-head">
              <h3>{station.name}</h3>
              <button
                type="button"
                className="icon-button"
                aria-label={`Edit ${station.name}`}
                onClick={() => onSelectStation(station)}
                title="Edit station"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                  <path
                    d="M3 17.25V21h3.75l11-11-3.75-3.75-11 11zm17.71-10.04a1.004 1.004 0 000-1.42l-2.5-2.5a1.004 1.004 0 00-1.42 0L14.83 5.25l3.75 3.75 2.13-2.09z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            </div>
            <p>{station.address}</p>
            <p>
              Points: {station.chargingPoints.length} | Connectors: {countConnectors(station)}
            </p>
          </article>
        ))}
      </div>

      <footer className="pagination">
        <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Prev
        </button>
        <span>
          Page {page} / {pageCount}
        </span>
        <button
          type="button"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </button>
      </footer>
    </section>
  );
}

export function ConsolePanel({ logs, busyActions, onClear }) {
  const isBusy = busyActions.has("clear-console");
  return (
    <aside className="console-panel">
      <div className="toolbar">
        <h2>SSE Console</h2>
        <button type="button" onClick={onClear} disabled={isBusy}>
          {isBusy ? "Clearing..." : "Clear Console"}
        </button>
      </div>
      <div className="console-list">
        {logs.map((item) => (
          <pre key={item.id}>{JSON.stringify(item, null, 2)}</pre>
        ))}
      </div>
    </aside>
  );
}
