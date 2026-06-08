import { useEffect, useMemo, useState } from "react";
import { ConsolePanel, StationsPanel } from "./components/MainPanels";
import {
  ConfirmModal,
  CpoConfigModal,
  CpoFormModal,
  StationDetailModal,
  StationFormModal
} from "./components/ModalComponents";

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

export default function App() {
  const [cpos, setCpos] = useState([]);
  const [selectedCpoId, setSelectedCpoId] = useState("");
  const [stations, setStations] = useState([]);
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [busyActions, setBusyActions] = useState(new Set());

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

  const selectedCpo = useMemo(
    () => cpos.find((item) => item.id === selectedCpoId) ?? null,
    [cpos, selectedCpoId]
  );

  const pageCount = Math.max(1, Math.ceil(stations.length / PAGE_SIZE));
  const pagedStations = useMemo(
    () => stations.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [stations, page]
  );

  function beginAction(actionKey) {
    setBusyActions((prev) => {
      const next = new Set(prev);
      next.add(actionKey);
      return next;
    });
  }

  function endAction(actionKey) {
    setBusyActions((prev) => {
      const next = new Set(prev);
      next.delete(actionKey);
      return next;
    });
  }

  async function runBusy(actionKey, task) {
    beginAction(actionKey);
    try {
      return await task();
    } finally {
      endAction(actionKey);
    }
  }

  function isBusy(actionKey) {
    return busyActions.has(actionKey);
  }

  async function loadCpos() {
    await runBusy("load-cpos", async () => {
      const result = await api("/api/cpos");
      setCpos(result.data);
      if (!selectedCpoId && result.data[0]) {
        setSelectedCpoId(result.data[0].id);
      }
    });
  }

  async function loadStations(cpoId) {
    if (!cpoId) return;
    await runBusy("load-stations", async () => {
      const result = await api(`/api/cpos/${cpoId}/stations/admin`);
      setStations(result.data);
      setPage(1);
    });
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
    setError("");
    try {
      await runBusy("create-cpo", () =>
        api("/api/cpos", { method: "POST", body: JSON.stringify(cpoForm) })
      );
      setCpoForm(emptyCpoForm);
      setShowCreateCpo(false);
      await loadCpos();
    } catch (err) {
      setError(err.message);
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
    await runBusy("update-cpo", async () => {
      await api(`/api/cpos/${selectedCpo.id}`, {
        method: "PUT",
        body: JSON.stringify(patch)
      });
      await loadCpos();
    });
  }

  async function deleteCpo() {
    if (!selectedCpo) return;
    try {
      await runBusy("delete-cpo", () =>
        api(`/api/cpos/${selectedCpo.id}`, { method: "DELETE" })
      );
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
      await runBusy("create-station", () =>
        api(`/api/cpos/${selectedCpo.id}/stations`, {
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
        })
      );
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
      await runBusy(`edit-station-${stationToEdit.id}`, () =>
        api(`/api/cpos/${selectedCpo.id}/stations/${stationToEdit.id}`, {
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
        })
      );
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
      await runBusy(`delete-station-${stationId}`, () =>
        api(`/api/cpos/${selectedCpo.id}/stations/${stationId}`, { method: "DELETE" })
      );
      setStationDetail(null);
      await loadStations(selectedCpo.id);
    } catch (err) {
      setError(err.message);
    }
  }

  async function addChargePoint(stationId) {
    if (!selectedCpo || !chargePointForm.id) return;
    try {
      await runBusy(`add-charge-point-${stationId}`, () =>
        api(`/api/cpos/${selectedCpo.id}/stations/${stationId}/charge-points`, {
          method: "POST",
          body: JSON.stringify({
            id: chargePointForm.id,
            status: chargePointForm.status,
            connectors: []
          })
        })
      );
      setChargePointForm(emptyChargePointForm);
      await loadStations(selectedCpo.id);
      setStationDetail((prev) => (prev ? { ...prev } : prev));
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteChargePoint(stationId, chargePointId) {
    if (!selectedCpo) return;
    try {
      await runBusy(
        `delete-charge-point-${stationId}-${chargePointId}`,
        () =>
          api(
            `/api/cpos/${selectedCpo.id}/stations/${stationId}/charge-points/${chargePointId}`,
            { method: "DELETE" }
          )
      );
      await loadStations(selectedCpo.id);
    } catch (err) {
      setError(err.message);
    }
  }

  async function addConnector(stationId, chargePointId, connectorPayload) {
    if (!selectedCpo || !connectorPayload.id) return;
    try {
      await runBusy(`add-connector-${stationId}-${chargePointId}`, () =>
        api(
          `/api/cpos/${selectedCpo.id}/stations/${stationId}/charge-points/${chargePointId}/connectors`,
          {
            method: "POST",
            body: JSON.stringify(connectorPayload)
          }
        )
      );
      await loadStations(selectedCpo.id);
    } catch (err) {
      setError(err.message);
    }
  }

  async function editConnector(stationId, chargePointId, connectorId, patch) {
    if (!selectedCpo) return;
    try {
      await runBusy(`edit-connector-${stationId}-${chargePointId}-${connectorId}`, () =>
        api(
          `/api/cpos/${selectedCpo.id}/stations/${stationId}/charge-points/${chargePointId}/connectors/${connectorId}`,
          { method: "PUT", body: JSON.stringify(patch) }
        )
      );
      await loadStations(selectedCpo.id);
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteConnector(stationId, chargePointId, connectorId) {
    if (!selectedCpo) return;
    try {
      await runBusy(`delete-connector-${stationId}-${chargePointId}-${connectorId}`, () =>
        api(
          `/api/cpos/${selectedCpo.id}/stations/${stationId}/charge-points/${chargePointId}/connectors/${connectorId}`,
          { method: "DELETE" }
        )
      );
      await loadStations(selectedCpo.id);
    } catch (err) {
      setError(err.message);
    }
  }

  async function simulator(action) {
    if (!selectedCpo) return;
    const actionKey = action === "start" ? "simulator-start" : "simulator-stop";
    try {
      await runBusy(actionKey, () =>
        api(`/api/cpos/${selectedCpo.id}/simulator/${action}`, { method: "POST" })
      );
      await loadCpos();
    } catch (err) {
      setError(err.message);
    }
  }

  async function loginAuth() {
    if (!selectedCpo) return;
    try {
      await runBusy("login-auth", () =>
        api(`/api/cpos/${selectedCpo.id}/auth/login`, {
          method: "POST",
          body: JSON.stringify({})
        })
      );
      await loadCpos();
    } catch (err) {
      setError(err.message);
    }
  }

  function clearConsole() {
    runBusy("clear-console", async () => {
      setLogs([]);
    }).catch((err) => setError(err.message));
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
        <StationsPanel
          selectedCpo={selectedCpo}
          pagedStations={pagedStations}
          page={page}
          pageCount={pageCount}
          busyActions={busyActions}
          onOpenCreateStation={() => setShowCreateStation(true)}
          onLoginAuth={loginAuth}
          onSimulator={simulator}
          onDeleteCpo={() => setConfirmDeleteCpo(true)}
          onSelectStation={setStationDetail}
          onPageChange={setPage}
        />

        <ConsolePanel logs={logs} busyActions={busyActions} onClear={clearConsole} />
      </main>

      {showCreateCpo && (
        <CpoFormModal
          title={cpoModalMode === "edit" ? "Edit Enterprise Config" : "Create CPO"}
          mode={cpoModalMode}
          form={cpoForm}
          setForm={setCpoForm}
          loading={isBusy(cpoModalMode === "edit" ? "update-cpo" : "create-cpo")}
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
          loading={isBusy("create-station")}
          submitLabel="Save Station"
          onSubmit={createStation}
          onClose={() => setShowCreateStation(false)}
        />
      )}

      {showEditStation && (
        <StationFormModal
          title="Edit Station"
          form={stationForm}
          setForm={setStationForm}
          loading={stationToEdit ? isBusy(`edit-station-${stationToEdit.id}`) : false}
          submitLabel="Update Station"
          onSubmit={editStation}
          onClose={() => setShowEditStation(false)}
        />
      )}

      {showConfig && (
        <CpoConfigModal
          cpo={selectedCpo}
          onClose={() => setShowConfig(false)}
          onLogin={loginAuth}
          loginLoading={isBusy("login-auth")}
          uiLocked={isBusy("update-cpo") || isBusy("delete-cpo") || isBusy("load-cpos")}
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
          loading={isBusy("delete-cpo")}
          onClose={() => setConfirmDeleteCpo(false)}
          onConfirm={deleteCpo}
        />
      )}

      {stationDetail && (
        <StationDetailModal
          station={stations.find((item) => item.id === stationDetail.id) ?? stationDetail}
          chargePointForm={chargePointForm}
          setChargePointForm={setChargePointForm}
          isBusy={isBusy}
          onClose={() => setStationDetail(null)}
          onEditStation={() => {
            beginAction("edit-station-open");
            const latest = stations.find((item) => item.id === stationDetail.id);
            if (!latest) {
              endAction("edit-station-open");
              return;
            }
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
            endAction("edit-station-open");
          }}
          onDeleteStation={() => deleteStation(stationDetail.id)}
          onAddChargePoint={() => addChargePoint(stationDetail.id)}
          onDeleteChargePoint={(chargePointId) =>
            deleteChargePoint(stationDetail.id, chargePointId)
          }
          onAddConnector={(chargePointId, connectorPayload) =>
            addConnector(stationDetail.id, chargePointId, connectorPayload)
          }
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
