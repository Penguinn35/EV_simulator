function Modal({ title, children, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <div className="modal-header">
          <h3>{title}</h3>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function CpoFormModal({
  title,
  mode,
  form,
  setForm,
  loading,
  onSubmit,
  onClose,
  submitLabel
}) {
  const fields = ["id", "name", "token", "baseUrl", "username", "password"];
  return (
    <Modal title={title} onClose={onClose}>
      <form
        className="form-grid"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        {fields.map((key) => (
          <label key={key} className="form-field">
            <span>{key}</span>
            <input
              value={form[key]}
              disabled={loading || (mode === "edit" && key === "id")}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, [key]: event.target.value }))
              }
            />
          </label>
        ))}
        <button type="submit" disabled={loading}>
          {loading ? `${submitLabel}...` : submitLabel}
        </button>
      </form>
    </Modal>
  );
}

export function StationFormModal({
  title,
  form,
  setForm,
  loading,
  submitLabel,
  onSubmit,
  onClose
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <form
        className="form-grid"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        {Object.keys(form).map((key) => (
          <label key={key} className="form-field">
            <span>{key}</span>
            <input
              value={form[key]}
              disabled={loading}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  [key]:
                    key === "status" || key === "latitude" || key === "longitude"
                      ? Number(event.target.value)
                      : event.target.value
                }))
              }
            />
          </label>
        ))}
        <button type="submit" disabled={loading}>
          {loading ? `${submitLabel}...` : submitLabel}
        </button>
      </form>
    </Modal>
  );
}

export function ConfirmModal({ title, description, loading, onConfirm, onClose }) {
  return (
    <Modal title={title} onClose={onClose}>
      <p>{description}</p>
      <div className="inline-actions">
        <button type="button" className="danger" disabled={loading} onClick={onConfirm}>
          {loading ? "Confirming..." : "Confirm"}
        </button>
      </div>
    </Modal>
  );
}

export function CpoConfigModal({ cpo, onClose, onEdit, onLogin, loginLoading, uiLocked }) {
  if (!cpo) return null;
  const { stations, ...configOnly } = cpo;
  return (
    <Modal title="Enterprise Configuration" onClose={onClose}>
      <pre className="config-block">{JSON.stringify(configOnly, null, 2)}</pre>
      <div className="inline-actions">
        <button type="button" disabled={uiLocked} onClick={onEdit}>
          Edit Config
        </button>
        <button type="button" disabled={uiLocked} onClick={onLogin}>
          {loginLoading ? "Logging in..." : "Login Auth"}
        </button>
      </div>
    </Modal>
  );
}

export function StationDetailModal({
  station,
  connectorForm,
  setConnectorForm,
  chargePointForm,
  setChargePointForm,
  isBusy,
  onClose,
  onEditStation,
  onDeleteStation,
  onAddChargePoint,
  onDeleteChargePoint,
  onAddConnector,
  onEditConnector,
  onDeleteConnector
}) {
  if (!station) return null;
  return (
    <Modal title={`Station Details - ${station.name}`} onClose={onClose}>
      <p>Address: {station.address}</p>
      <p>District: {station.district}</p>
      <p>
        Position: {station.position.latitude}, {station.position.longitude}
      </p>
      <div className="inline-actions">
        <button type="button" disabled={isBusy("edit-station-open")} onClick={onEditStation}>
          {isBusy("edit-station-open") ? "Opening..." : "Edit Station"}
        </button>
        <button
          type="button"
          className="danger"
          disabled={isBusy(`delete-station-${station.id}`)}
          onClick={onDeleteStation}
        >
          {isBusy(`delete-station-${station.id}`) ? "Deleting..." : "Delete Station"}
        </button>
      </div>

      <h4>Charge Points</h4>
      <form
        className="inline-form"
        onSubmit={(event) => {
          event.preventDefault();
          onAddChargePoint();
        }}
      >
        <input
          placeholder="charge point id"
          value={chargePointForm.id}
          disabled={isBusy(`add-charge-point-${station.id}`)}
          onChange={(event) =>
            setChargePointForm((prev) => ({ ...prev, id: event.target.value }))
          }
        />
        <input
          placeholder="status"
          value={chargePointForm.status}
          disabled={isBusy(`add-charge-point-${station.id}`)}
          onChange={(event) =>
            setChargePointForm((prev) => ({ ...prev, status: Number(event.target.value) }))
          }
        />
        <button type="submit" disabled={isBusy(`add-charge-point-${station.id}`)}>
          {isBusy(`add-charge-point-${station.id}`) ? "Adding..." : "Add CP"}
        </button>
      </form>

      {station.chargingPoints.map((chargePoint) => (
        <div className="chargepoint-item" key={chargePoint.id}>
          <div className="chargepoint-head">
            <strong>{chargePoint.id}</strong>
            <button
              type="button"
              className="danger"
              disabled={isBusy(`delete-charge-point-${station.id}-${chargePoint.id}`)}
              onClick={() => onDeleteChargePoint(chargePoint.id)}
            >
              {isBusy(`delete-charge-point-${station.id}-${chargePoint.id}`)
                ? "Deleting..."
                : "Delete CP"}
            </button>
          </div>

          <form
            className="inline-form"
            onSubmit={(event) => {
              event.preventDefault();
              onAddConnector(chargePoint.id);
            }}
          >
            <input
              placeholder="connector id"
              value={connectorForm.id}
              disabled={isBusy(`add-connector-${station.id}-${chargePoint.id}`)}
              onChange={(event) =>
                setConnectorForm((prev) => ({ ...prev, id: event.target.value }))
              }
            />
            <input
              placeholder="price"
              value={connectorForm.price}
              disabled={isBusy(`add-connector-${station.id}-${chargePoint.id}`)}
              onChange={(event) =>
                setConnectorForm((prev) => ({
                  ...prev,
                  price: Number(event.target.value)
                }))
              }
            />
            <label className="checkbox-inline">
              <input
                type="checkbox"
                checked={connectorForm.isAvailable}
                disabled={isBusy(`add-connector-${station.id}-${chargePoint.id}`)}
                onChange={(event) =>
                  setConnectorForm((prev) => ({
                    ...prev,
                    isAvailable: event.target.checked
                  }))
                }
              />
              isAvailable
            </label>
            <button type="submit" disabled={isBusy(`add-connector-${station.id}-${chargePoint.id}`)}>
              {isBusy(`add-connector-${station.id}-${chargePoint.id}`) ? "Adding..." : "Add Connector"}
            </button>
          </form>

          <ul>
            {chargePoint.connectors.map((connector) => (
              <li key={connector.id}>
                <span>
                  {connector.id} | price: {connector.price} | available:{" "}
                  {String(connector.isAvailable)}
                </span>
                <div className="inline-actions">
                  <button
                    type="button"
                    disabled={isBusy(
                      `edit-connector-${station.id}-${chargePoint.id}-${connector.id}`
                    )}
                    onClick={() =>
                      onEditConnector(chargePoint.id, connector.id, {
                        price: connector.price + 100,
                        isAvailable: !connector.isAvailable
                      })
                    }
                  >
                    {isBusy(`edit-connector-${station.id}-${chargePoint.id}-${connector.id}`)
                      ? "Updating..."
                      : "Quick Edit"}
                  </button>
                  <button
                    type="button"
                    className="danger"
                    disabled={isBusy(
                      `delete-connector-${station.id}-${chargePoint.id}-${connector.id}`
                    )}
                    onClick={() => onDeleteConnector(chargePoint.id, connector.id)}
                  >
                    {isBusy(`delete-connector-${station.id}-${chargePoint.id}-${connector.id}`)
                      ? "Deleting..."
                      : "Delete"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </Modal>
  );
}
