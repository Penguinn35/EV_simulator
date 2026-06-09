import { useState } from "react";

const emptyConnectorForm = {
  id: "",
  type: 1,
  price: 3200,
  voltage: 400,
  maxPower: 22,
  status: "AVAILABLE"
};

let modalZIndexCounter = 1000;

function Modal({ title, children, onClose }) {
  const [zIndex] = useState(() => {
    modalZIndexCounter += 20;
    return modalZIndexCounter;
  });

  return (
    <div className="modal-backdrop" style={{ zIndex }} onClick={onClose}>
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
  const [showConnectorModal, setShowConnectorModal] = useState(false);
  const [connectorModalMode, setConnectorModalMode] = useState("create");
  const [activeChargePointId, setActiveChargePointId] = useState("");
  const [activeConnectorId, setActiveConnectorId] = useState("");
  const [connectorModalForm, setConnectorModalForm] = useState(emptyConnectorForm);
  const stationId = station?.id ?? "";

  const connectorBusyKey =
    connectorModalMode === "create"
      ? `add-connector-${stationId}-${activeChargePointId}`
      : `edit-connector-${stationId}-${activeChargePointId}-${activeConnectorId}`;

  if (!station) return null;

  async function submitConnectorForm() {
    if (!activeChargePointId) return;
    if (connectorModalMode === "create") {
      await onAddConnector(activeChargePointId, connectorModalForm);
    } else {
      await onEditConnector(activeChargePointId, activeConnectorId, connectorModalForm);
    }
    setShowConnectorModal(false);
    setConnectorModalForm(emptyConnectorForm);
    setActiveChargePointId("");
    setActiveConnectorId("");
  }

  function openCreateConnector(chargePointId) {
    setConnectorModalMode("create");
    setActiveChargePointId(chargePointId);
    setActiveConnectorId("");
    setConnectorModalForm(emptyConnectorForm);
    setShowConnectorModal(true);
  }

  function openEditConnector(chargePointId, connector) {
    setConnectorModalMode("edit");
    setActiveChargePointId(chargePointId);
    setActiveConnectorId(connector.id);
    setConnectorModalForm({
      id: connector.id,
      type: connector.type,
      price: connector.price,
      voltage: connector.voltage,
      maxPower: connector.maxPower,
      status: connector.status ?? (connector.isAvailable ? "AVAILABLE" : "IN_USE")
    });
    setShowConnectorModal(true);
  }

  return (
    <>
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
              <div className="inline-actions">
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Add connector on ${chargePoint.id}`}
                  title="Add connector"
                  onClick={() => openCreateConnector(chargePoint.id)}
                >
                  +
                </button>
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
            </div>

            <ul>
              {chargePoint.connectors.map((connector) => (
                <li key={connector.id}>
                  <span>
                    {connector.id} | type: {connector.type} | price: {connector.price} | voltage:{" "}
                    {connector.voltage} | maxPower: {connector.maxPower} | status:{" "}
                    {connector.status ?? (connector.isAvailable ? "AVAILABLE" : "IN_USE")}
                  </span>
                  <div className="inline-actions">
                    <button
                      type="button"
                      disabled={isBusy(
                        `edit-connector-${station.id}-${chargePoint.id}-${connector.id}`
                      )}
                      onClick={() => openEditConnector(chargePoint.id, connector)}
                    >
                      {isBusy(`edit-connector-${station.id}-${chargePoint.id}-${connector.id}`)
                        ? "Updating..."
                        : "Edit"}
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

      {showConnectorModal && (
        <Modal
          title={
            connectorModalMode === "create"
              ? `Add Connector - ${activeChargePointId}`
              : `Edit Connector - ${activeConnectorId}`
          }
          onClose={() => setShowConnectorModal(false)}
        >
          <form
            className="form-grid"
            onSubmit={(event) => {
              event.preventDefault();
              submitConnectorForm();
            }}
          >
            <label className="form-field">
              <span>id</span>
              <input
                value={connectorModalForm.id}
                disabled={isBusy(connectorBusyKey) || connectorModalMode === "edit"}
                onChange={(event) =>
                  setConnectorModalForm((prev) => ({ ...prev, id: event.target.value }))
                }
              />
            </label>
            <label className="form-field">
              <span>type</span>
              <input
                type="number"
                value={connectorModalForm.type}
                disabled={isBusy(connectorBusyKey)}
                onChange={(event) =>
                  setConnectorModalForm((prev) => ({ ...prev, type: Number(event.target.value) }))
                }
              />
            </label>
            <label className="form-field">
              <span>price</span>
              <input
                type="number"
                value={connectorModalForm.price}
                disabled={isBusy(connectorBusyKey)}
                onChange={(event) =>
                  setConnectorModalForm((prev) => ({ ...prev, price: Number(event.target.value) }))
                }
              />
            </label>
            <label className="form-field">
              <span>voltage</span>
              <input
                type="number"
                value={connectorModalForm.voltage}
                disabled={isBusy(connectorBusyKey)}
                onChange={(event) =>
                  setConnectorModalForm((prev) => ({
                    ...prev,
                    voltage: Number(event.target.value)
                  }))
                }
              />
            </label>
            <label className="form-field">
              <span>maxPower</span>
              <input
                type="number"
                value={connectorModalForm.maxPower}
                disabled={isBusy(connectorBusyKey)}
                onChange={(event) =>
                  setConnectorModalForm((prev) => ({
                    ...prev,
                    maxPower: Number(event.target.value)
                  }))
                }
              />
            </label>
            <label className="form-field">
              <span>status</span>
              <select
                value={connectorModalForm.status}
                disabled={isBusy(connectorBusyKey)}
                onChange={(event) =>
                  setConnectorModalForm((prev) => ({ ...prev, status: event.target.value }))
                }
              >
                <option value="AVAILABLE">AVAILABLE</option>
                <option value="IN_USE">IN_USE</option>
                <option value="OFFLINE">OFFLINE</option>
                <option value="MAINTENANCE">MAINTENANCE</option>
              </select>
            </label>
            <button type="submit" disabled={isBusy(connectorBusyKey)}>
              {isBusy(connectorBusyKey)
                ? connectorModalMode === "create"
                  ? "Adding..."
                  : "Updating..."
                : connectorModalMode === "create"
                  ? "Add Connector"
                  : "Update Connector"}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
