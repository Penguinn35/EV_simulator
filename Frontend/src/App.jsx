import { useEffect, useMemo, useState } from "react";

const PAGE_SIZE = 10;

const emptyCpoForm = {
  id: "",
  name: "",
  token: "",
  baseUrl: "",
  username: "",
  password: ""
};

const emptyStationForm = {
  id: "",
  name: "",
  address: "",
  district: "",
  status: 1,
  latitude: 10.77,
  longitude: 106.7
};

const emptyChargePointForm = { id: "", status: 1 };
const emptyConnectorForm = {
  id: "",
  type: 1,
  price: 3200,
  voltage: 400,
  maxPower: 22,
  isAvailable: true
};

async function api(path, options) {
  const response = await fetch(path, {
    headers: { "content-type": "application/json" },
    ...options
  });
  if (response.status === 204) {
    return null;
  }
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message ?? "Request failed");
  }
  return data;
}

function countConnectors(station) {
  return station.chargingPoints.reduce(
    (total, chargePoint) => total + chargePoint.connectors.length,
    0
  );
}

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
          <button onClick={onClose}>Close</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

function CpoFormModal({
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
              disabled={mode === "edit" && key === "id"}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, [key]: event.target.value }))
              }
            />
          </label>
        ))}
        <button type="submit" disabled={loading}>
          {submitLabel}
        </button>
      </form>
    </Modal>
  );
}

function StationFormModal({ title, form, setForm, onSubmit, onClose }) {
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
        <button type="submit">Save Station</button>
      </form>
    </Modal>
  );
}

function ConfirmModal({ title, description, onConfirm, onClose }) {
  return (
    <Modal title={title} onClose={onClose}>
      <p>{description}</p>
      <div className="inline-actions">
        <button className="danger" onClick={onConfirm}>
          Confirm
        </button>
      </div>
    </Modal>
  );
}

function CpoConfigModal({ cpo, onClose, onEdit, onLogin }) {
  if (!cpo) return null;
  const { stations, ...configOnly } = cpo;
  return (
    <Modal title="Enterprise Configuration" onClose={onClose}>
      <pre className="config-block">{JSON.stringify(configOnly, null, 2)}</pre>
      <div className="inline-actions">
        <button onClick={onEdit}>Edit Config</button>
        <button onClick={onLogin}>Login Auth</button>
      </div>
    </Modal>
  );
}

function StationDetailModal({
  station,
  connectorForm,
  setConnectorForm,
  chargePointForm,
  setChargePointForm,
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
        <button onClick={onEditStation}>Edit Station</button>
        <button className="danger" onClick={onDeleteStation}>
          Delete Station
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
          onChange={(event) =>
            setChargePointForm((prev) => ({ ...prev, id: event.target.value }))
          }
        />
        <input
          placeholder="status"
          value={chargePointForm.status}
          onChange={(event) =>
            setChargePointForm((prev) => ({ ...prev, status: Number(event.target.value) }))
          }
        />
        <button type="submit">Add CP</button>
      </form>

      {station.chargingPoints.map((chargePoint) => (
        <div className="chargepoint-item" key={chargePoint.id}>
          <div className="chargepoint-head">
            <strong>{chargePoint.id}</strong>
            <button className="danger" onClick={() => onDeleteChargePoint(chargePoint.id)}>
              Delete CP
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
              onChange={(event) =>
                setConnectorForm((prev) => ({ ...prev, id: event.target.value }))
              }
            />
            <input
              placeholder="price"
              value={connectorForm.price}
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
                onChange={(event) =>
                  setConnectorForm((prev) => ({
                    ...prev,
                    isAvailable: event.target.checked
                  }))
                }
              />
              isAvailable
            </label>
            <button type="submit">Add Connector</button>
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
                    onClick={() =>
                      onEditConnector(chargePoint.id, connector.id, {
                        price: connector.price + 100,
                        isAvailable: !connector.isAvailable
                      })
                    }
                  >
                    Quick Edit
                  </button>
                  <button
                    className="danger"
                    onClick={() => onDeleteConnector(chargePoint.id, connector.id)}
                  >
                    Delete
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

export default function App() {
  const [cpos, setCpos] = useState([]);
  const [selectedCpoId, setSelectedCpoId] = useState("");
  const [stations, setStations] = useState([]);
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [showCreateCpo, setShowCreateCpo] = useState(false);
  const [cpoModalMode, setCpoModalMode] = useState("create");
  const [showConfig, setShowConfig] = useState(false);
  const [confirmDeleteCpo, setConfirmDeleteCpo] = useState(false);
  const [stationDetail, setStationDetail] = useState(null);
  const [showCreateStation, setShowCreateStation] = useState(false);
  const [showEditStation, setShowEditStation] = useState(false);
  const [stationToEdit, setStationToEdit] = useState(null);

  const [cpoForm, setCpoForm] = useState(emptyCpoForm);
  const [stationForm, setStationForm] = useState(emptyStationForm);
  const [chargePointForm, setChargePointForm] = useState(emptyChargePointForm);
  const [connectorForm, setConnectorForm] = useState(emptyConnectorForm);

  const selectedCpo = useMemo(
    () => cpos.find((item) => item.id === selectedCpoId) ?? null,
    [cpos, selectedCpoId]
  );

  const pageCount = Math.max(1, Math.ceil(stations.length / PAGE_SIZE));
  const pagedStations = useMemo(
    () => stations.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [stations, page]
  );

  async function loadCpos() {
    const result = await api("/api/cpos");
    setCpos(result.data);
    if (!selectedCpoId && result.data[0]) {
      setSelectedCpoId(result.data[0].id);
    }
  }

  async function loadStations(cpoId) {
    if (!cpoId) return;
    const result = await api(`/api/cpos/${cpoId}/stations/admin`);
    setStations(result.data);
    setPage(1);
  }

  useEffect(() => {
    loadCpos().catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    loadStations(selectedCpoId).catch((err) => setError(err.message));
  }, [selectedCpoId]);

  useEffect(() => {
    const eventSource = new EventSource(
      selectedCpoId ? `/api/stream/events?cpoId=${selectedCpoId}` : "/api/stream/events"
    );
    eventSource.onmessage = (message) => {
      try {
        const payload = JSON.parse(message.data);
        setLogs((prev) => [payload, ...prev].slice(0, 300));
      } catch {
        // ignore invalid json
      }
    };
    return () => eventSource.close();
  }, [selectedCpoId]);

  async function createCpo() {
    setLoading(true);
    setError("");
    try {
      await api("/api/cpos", { method: "POST", body: JSON.stringify(cpoForm) });
      setCpoForm(emptyCpoForm);
      setShowCreateCpo(false);
      await loadCpos();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveCpo() {
    if (cpoModalMode === "edit" && selectedCpo) {
      try {
        await updateCpo({
          name: cpoForm.name,
          token: cpoForm.token,
          baseUrl: cpoForm.baseUrl,
          username: cpoForm.username,
          password: cpoForm.password
        });
        setShowCreateCpo(false);
        setShowConfig(true);
      } catch (err) {
        setError(err.message);
      }
      return;
    }
    await createCpo();
  }

  async function updateCpo(patch) {
    if (!selectedCpo) return;
    await api(`/api/cpos/${selectedCpo.id}`, {
      method: "PUT",
      body: JSON.stringify(patch)
    });
    await loadCpos();
  }

  async function deleteCpo() {
    if (!selectedCpo) return;
    try {
      await api(`/api/cpos/${selectedCpo.id}`, { method: "DELETE" });
      setConfirmDeleteCpo(false);
      setShowConfig(false);
      setSelectedCpoId("");
      await loadCpos();
    } catch (err) {
      setError(err.message);
    }
  }

  async function createStation() {
    if (!selectedCpo) return;
    try {
      await api(`/api/cpos/${selectedCpo.id}/stations`, {
        method: "POST",
        body: JSON.stringify({
          id: stationForm.id || `cs-${Date.now()}`,
          name: stationForm.name,
          address: stationForm.address,
          district: stationForm.district,
          status: stationForm.status,
          position: {
            latitude: stationForm.latitude,
            longitude: stationForm.longitude
          },
          chargingPoints: []
        })
      });
      setShowCreateStation(false);
      setStationForm(emptyStationForm);
      await loadStations(selectedCpo.id);
    } catch (err) {
      setError(err.message);
    }
  }

  async function editStation() {
    if (!selectedCpo || !stationToEdit) return;
    try {
      await api(`/api/cpos/${selectedCpo.id}/stations/${stationToEdit.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: stationForm.name,
          address: stationForm.address,
          district: stationForm.district,
          status: stationForm.status,
          position: {
            latitude: stationForm.latitude,
            longitude: stationForm.longitude
          }
        })
      });
      setShowEditStation(false);
      setStationToEdit(null);
      await loadStations(selectedCpo.id);
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteStation(stationId) {
    if (!selectedCpo) return;
    try {
      await api(`/api/cpos/${selectedCpo.id}/stations/${stationId}`, { method: "DELETE" });
      setStationDetail(null);
      await loadStations(selectedCpo.id);
    } catch (err) {
      setError(err.message);
    }
  }

  async function addChargePoint(stationId) {
    if (!selectedCpo || !chargePointForm.id) return;
    try {
      await api(`/api/cpos/${selectedCpo.id}/stations/${stationId}/charge-points`, {
        method: "POST",
        body: JSON.stringify({
          id: chargePointForm.id,
          status: chargePointForm.status,
          connectors: []
        })
      });
      setChargePointForm(emptyChargePointForm);
      await loadStations(selectedCpo.id);
      setStationDetail((prev) =>
        prev ? stations.find((item) => item.id === prev.id) ?? prev : prev
      );
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteChargePoint(stationId, chargePointId) {
    if (!selectedCpo) return;
    try {
      await api(
        `/api/cpos/${selectedCpo.id}/stations/${stationId}/charge-points/${chargePointId}`,
        { method: "DELETE" }
      );
      await loadStations(selectedCpo.id);
    } catch (err) {
      setError(err.message);
    }
  }

  async function addConnector(stationId, chargePointId) {
    if (!selectedCpo || !connectorForm.id) return;
    try {
      await api(
        `/api/cpos/${selectedCpo.id}/stations/${stationId}/charge-points/${chargePointId}/connectors`,
        {
          method: "POST",
          body: JSON.stringify(connectorForm)
        }
      );
      setConnectorForm(emptyConnectorForm);
      await loadStations(selectedCpo.id);
    } catch (err) {
      setError(err.message);
    }
  }

  async function editConnector(stationId, chargePointId, connectorId, patch) {
    if (!selectedCpo) return;
    try {
      await api(
        `/api/cpos/${selectedCpo.id}/stations/${stationId}/charge-points/${chargePointId}/connectors/${connectorId}`,
        { method: "PUT", body: JSON.stringify(patch) }
      );
      await loadStations(selectedCpo.id);
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteConnector(stationId, chargePointId, connectorId) {
    if (!selectedCpo) return;
    try {
      await api(
        `/api/cpos/${selectedCpo.id}/stations/${stationId}/charge-points/${chargePointId}/connectors/${connectorId}`,
        { method: "DELETE" }
      );
      await loadStations(selectedCpo.id);
    } catch (err) {
      setError(err.message);
    }
  }

  async function simulator(action) {
    if (!selectedCpo) return;
    try {
      await api(`/api/cpos/${selectedCpo.id}/simulator/${action}`, { method: "POST" });
      await loadCpos();
    } catch (err) {
      setError(err.message);
    }
  }

  async function loginAuth() {
    if (!selectedCpo) return;
    try {
      await api(`/api/cpos/${selectedCpo.id}/auth/login`, {
        method: "POST",
        body: JSON.stringify({})
      });
      await loadCpos();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="app">
      <header className="nav">
        <div className="brand">OCPI Simulator</div>
        <div className="tabs">
          {cpos.map((cpo) => (
            <button
              className={cpo.id === selectedCpoId ? "tab active" : "tab"}
              key={cpo.id}
              onClick={() => setSelectedCpoId(cpo.id)}
            >
              {cpo.name}
            </button>
          ))}
        </div>
        <div className="nav-right">
          <button onClick={() => setShowConfig(true)} disabled={!selectedCpo}>
            Enterprise Info
          </button>
          <button
            className="primary"
            onClick={() => {
              setCpoModalMode("create");
              setCpoForm(emptyCpoForm);
              setShowCreateCpo(true);
            }}
          >
            + Create CPO
          </button>
        </div>
      </header>

      {error && <div className="error">{error}</div>}

      <main className="content">
        <section className="stations-panel">
          <div className="toolbar">
            <h2>{selectedCpo ? `${selectedCpo.name} Stations` : "Select a CPO"}</h2>
            <div className="toolbar-actions">
              <button onClick={() => setShowCreateStation(true)} disabled={!selectedCpo}>
                Add Station
              </button>
              <button onClick={loginAuth} disabled={!selectedCpo}>
                Login Auth
              </button>
              <button onClick={() => simulator("start")} disabled={!selectedCpo}>
                Start Simulator
              </button>
              <button onClick={() => simulator("stop")} disabled={!selectedCpo}>
                Stop Simulator
              </button>
              <button
                className="danger"
                onClick={() => setConfirmDeleteCpo(true)}
                disabled={!selectedCpo}
              >
                Delete CPO
              </button>
            </div>
          </div>

          <div className="station-list">
            {pagedStations.map((station) => (
              <article
                className="station-card simple"
                key={station.id}
                onClick={() => setStationDetail(station)}
              >
                <h3>{station.name}</h3>
                <p>{station.address}</p>
                <p>
                  Points: {station.chargingPoints.length} | Connectors:{" "}
                  {countConnectors(station)}
                </p>
              </article>
            ))}
          </div>

          <footer className="pagination">
            <button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
              Prev
            </button>
            <span>
              Page {page} / {pageCount}
            </span>
            <button
              disabled={page >= pageCount}
              onClick={() => setPage((value) => value + 1)}
            >
              Next
            </button>
          </footer>
        </section>

        <aside className="console-panel">
          <div className="toolbar">
            <h2>SSE Console</h2>
            <button onClick={() => setLogs([])}>Clear Console</button>
          </div>
          <div className="console-list">
            {logs.map((item) => (
              <pre key={item.id}>{JSON.stringify(item, null, 2)}</pre>
            ))}
          </div>
        </aside>
      </main>

      {showCreateCpo && (
        <CpoFormModal
          title={cpoModalMode === "edit" ? "Edit Enterprise Config" : "Create CPO"}
          mode={cpoModalMode}
          form={cpoForm}
          setForm={setCpoForm}
          loading={loading}
          onSubmit={saveCpo}
          submitLabel={cpoModalMode === "edit" ? "Update CPO" : "Save CPO"}
          onClose={() => setShowCreateCpo(false)}
        />
      )}

      {showCreateStation && (
        <StationFormModal
          title="Create Station"
          form={stationForm}
          setForm={setStationForm}
          onSubmit={createStation}
          onClose={() => setShowCreateStation(false)}
        />
      )}

      {showEditStation && (
        <StationFormModal
          title="Edit Station"
          form={stationForm}
          setForm={setStationForm}
          onSubmit={editStation}
          onClose={() => setShowEditStation(false)}
        />
      )}

      {showConfig && (
        <CpoConfigModal
          cpo={selectedCpo}
          onClose={() => setShowConfig(false)}
          onLogin={loginAuth}
          onEdit={() => {
            if (!selectedCpo) return;
            setCpoForm({
              id: selectedCpo.id,
              name: selectedCpo.name,
              token: selectedCpo.token,
              baseUrl: selectedCpo.baseUrl ?? "",
              username: selectedCpo.username ?? "",
              password: selectedCpo.password ?? ""
            });
            setCpoModalMode("edit");
            setShowConfig(false);
            setShowCreateCpo(true);
          }}
        />
      )}

      {confirmDeleteCpo && selectedCpo && (
        <ConfirmModal
          title="Delete CPO"
          description={`Delete ${selectedCpo.name}?`}
          onClose={() => setConfirmDeleteCpo(false)}
          onConfirm={deleteCpo}
        />
      )}

      {stationDetail && (
        <StationDetailModal
          station={stations.find((item) => item.id === stationDetail.id) ?? stationDetail}
          connectorForm={connectorForm}
          setConnectorForm={setConnectorForm}
          chargePointForm={chargePointForm}
          setChargePointForm={setChargePointForm}
          onClose={() => setStationDetail(null)}
          onEditStation={() => {
            const latest = stations.find((item) => item.id === stationDetail.id);
            if (!latest) return;
            setStationToEdit(latest);
            setStationForm({
              id: latest.id,
              name: latest.name,
              address: latest.address,
              district: latest.district,
              status: latest.status,
              latitude: latest.position.latitude,
              longitude: latest.position.longitude
            });
            setShowEditStation(true);
          }}
          onDeleteStation={() => deleteStation(stationDetail.id)}
          onAddChargePoint={() => addChargePoint(stationDetail.id)}
          onDeleteChargePoint={(chargePointId) =>
            deleteChargePoint(stationDetail.id, chargePointId)
          }
          onAddConnector={(chargePointId) => addConnector(stationDetail.id, chargePointId)}
          onEditConnector={(chargePointId, connectorId, patch) =>
            editConnector(stationDetail.id, chargePointId, connectorId, patch)
          }
          onDeleteConnector={(chargePointId, connectorId) =>
            deleteConnector(stationDetail.id, chargePointId, connectorId)
          }
        />
      )}
    </div>
  );
}
