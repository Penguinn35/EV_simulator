import { CONNECTOR_STATUSES, EVENT_TYPES } from "../constants.js";
import { createId, deepClone, randomInt, randomItem } from "../utils.js";

function notFound(name) {
  const error = new Error(`${name} not found`);
  error.status = 404;
  return error;
}

function getStation(cpo, stationId) {
  const station = cpo.stations.find((item) => item.id === stationId);
  if (!station) {
    throw notFound("Station");
  }
  return station;
}

function getChargePoint(station, chargePointId) {
  const chargePoint = station.chargingPoints.find((item) => item.id === chargePointId);
  if (!chargePoint) {
    throw notFound("Charge point");
  }
  return chargePoint;
}

function getConnector(chargePoint, connectorId) {
  const connector = chargePoint.connectors.find((item) => item.id === connectorId);
  if (!connector) {
    throw notFound("Connector");
  }
  return connector;
}

function hasStations(cpo) {
  return Array.isArray(cpo.stations) && cpo.stations.length > 0;
}

function isConnectorStatus(value) {
  return CONNECTOR_STATUSES.includes(value);
}

function statusFromAvailability(isAvailable) {
  return isAvailable ? "AVAILABLE" : "IN_USE";
}

function getWeightedInitialConnectorStatus() {
  return Math.random() < 0.7 ? "AVAILABLE" : "IN_USE";
}

function normalizeConnectorStatus(status, fallback = "AVAILABLE") {
  if (typeof status !== "string") {
    return fallback;
  }
  const normalized = status.trim().toUpperCase();
  return isConnectorStatus(normalized) ? normalized : fallback;
}

function syncConnectorStatusFields(connector) {
  const status = isConnectorStatus(connector.status)
    ? connector.status
    : statusFromAvailability(connector.isAvailable ?? true);
  connector.status = status;
  connector.isAvailable = status === "AVAILABLE";
  return connector;
}

function normalizeBaseUrl(baseUrl) {
  if (!baseUrl) {
    return "";
  }
  return baseUrl.trim().replace(/\/+$/, "");
}

function buildUrl(baseUrl, suffix) {
  const root = normalizeBaseUrl(baseUrl);
  if (!root) {
    return "";
  }
  try {
    return new URL(suffix, `${root}/`).toString();
  } catch {
    return `${root}${suffix.startsWith("/") ? suffix : `/${suffix}`}`;
  }
}

function createRandomStation(cpoId) {
  const stationId = createId("cs");
  return {
    id: stationId,
    name: `Auto Station ${stationId.slice(-4)}`,
    position: {
      latitude: 10 + randomInt(0, 9999) / 10000,
      longitude: 106 + randomInt(0, 9999) / 10000
    },
    address: `Generated Address ${randomInt(1, 999)}`,
    district: "Generated District",
    status: randomInt(0, 1),
    cpoId,
    chargingPoints: []
  };
}

function createRandomChargePoint(stationId) {
  return {
    id: `${stationId.replace("cs-", "cp-")}-${randomInt(10, 99)}`,
    status: randomInt(0, 3),
    connectors: []
  };
}

function createRandomConnector(chargePointId) {
  const status = getWeightedInitialConnectorStatus();
  return {
    id: `${chargePointId.replace("cp-", "cn-")}-${randomInt(1, 20)}`,
    type: randomInt(0, 2),
    price: randomInt(2500, 4500),
    voltage: randomItem([220, 380, 400, 800]),
    maxPower: randomItem([7.4, 22, 60, 120, 250]),
    status,
    isAvailable: status === "AVAILABLE"
  };
}

function createStationPayload(station) {
  return {
    id: station.id,
    name: station.name,
    position: {
      latitude: station.position?.latitude ?? 0,
      longitude: station.position?.longitude ?? 0
    },
    address: station.address ?? "",
    district: station.district ?? "",
    chargingPoints: Array.isArray(station.chargingPoints) ? station.chargingPoints : []
  };
}

function pickRandomConnectorContext(cpo) {
  if (!hasStations(cpo)) {
    return null;
  }
  const stationsWithChargePoints = cpo.stations.filter(
    (station) => Array.isArray(station.chargingPoints) && station.chargingPoints.length > 0
  );
  if (stationsWithChargePoints.length === 0) {
    return null;
  }
  const station = randomItem(stationsWithChargePoints);
  const chargePointsWithConnectors = station.chargingPoints.filter(
    (chargePoint) => Array.isArray(chargePoint.connectors) && chargePoint.connectors.length > 0
  );
  if (chargePointsWithConnectors.length === 0) {
    return null;
  }
  const chargePoint = randomItem(chargePointsWithConnectors);
  const connector = randomItem(chargePoint.connectors);
  if (!connector) {
    return null;
  }
  return { station, chargePoint, connector };
}

function findConnectorInCpoById(cpo, connectorId) {
  for (const station of cpo.stations) {
    for (const chargePoint of station.chargingPoints) {
      const connector = chargePoint.connectors.find((item) => item.id === connectorId);
      if (connector) {
        return connector;
      }
    }
  }
  return null;
}

function pickNextConnectorStatus(currentStatus) {
  const roll = Math.random();
  if (roll < 0.2) {
    return "OFFLINE";
  }
  if (roll < 0.25) {
    return "MAINTENANCE";
  }
  if (currentStatus === "IN_USE") {
    return "AVAILABLE";
  }
  if (currentStatus === "AVAILABLE") {
    return "IN_USE";
  }
  return Math.random() < 0.5 ? "AVAILABLE" : "IN_USE";
}

async function dispatchEventToRemote(cpo, eventType, payload) {
  const targetUrl = buildUrl(cpo.baseUrl, "/api/business/stations/events");
  if (!targetUrl) {
    return {
      ok: false,
      status: null,
      message: "baseUrl is empty"
    };
  }

  try {
    // eslint-disable-next-line no-console
    console.log(
      `[BE][OUTBOUND][EVENT][REQUEST] url=${targetUrl} eventType=${eventType} cpoId=${cpo.id}`
    );
    // eslint-disable-next-line no-console
    console.log(
      "[BE][OUTBOUND][EVENT][PAYLOAD]",
      JSON.stringify({ eventType, payload }, null, 2)
    );

    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(cpo.authSession?.token
          ? { authorization: `Bearer ${cpo.authSession.token}` }
          : {})
      },
      body: JSON.stringify({ eventType, payload })
    });
    let responseBody = null;
    try {
      responseBody = await response.clone().json();
    } catch {
      responseBody = null;
    }
    // eslint-disable-next-line no-console
    console.log(
      "[BE][OUTBOUND][EVENT][RESPONSE]",
      JSON.stringify(
        {
          url: targetUrl,
          status: response.status,
          ok: response.ok,
          body: responseBody
        },
        null,
        2
      )
    );
    const responseMessage =
      responseBody?.message ??
      responseBody?.error?.message ??
      responseBody?.httpStatus ??
      "fail";

    if (response.status === 401 || response.status === 403) {
      return { ok: false, status: 404, message: responseMessage };
    }

    if (!response.ok) {
      return { ok: false, status: response.status, message: responseMessage };
    }

    return { ok: true, status: response.status, message: "success" };
  } catch (error) {
    return { ok: false, status: null, message: `fail: ${error.message}` };
  }
}

export function createCpoService({ store, eventBus }) {
  function listCpos() {
    return store.getCpos().map((item) => ({
      ...item,
      stationsCount: item.stations.length
    }));
  }

  async function createCpo(payload) {
    if (!payload.name) {
      throw new Error("name is required");
    }
    if (!payload.id) {
      throw new Error("id is required");
    }
    if (store.getCpoById(payload.id)) {
      const error = new Error("CPO id already exists");
      error.status = 409;
      throw error;
    }
    const cpo = await store.createCpo(payload);
    eventBus.emit({ scope: "CPO_CREATE", cpoId: cpo.id, payload: deepClone(cpo) });
    return cpo;
  }

  async function updateCpo(cpoId, payload) {
    const cpo = await store.updateCpo(cpoId, payload);
    if (!cpo) {
      throw notFound("CPO");
    }
    eventBus.emit({ scope: "CPO_UPDATE", cpoId, payload: deepClone(payload) });
    return cpo;
  }

  async function deleteCpo(cpoId) {
    const ok = await store.deleteCpo(cpoId);
    if (!ok) {
      throw notFound("CPO");
    }
    eventBus.emit({ scope: "CPO_DELETE", cpoId, payload: {} });
  }

  function getCpoStations(cpoId) {
    const cpo = store.getCpoById(cpoId);
    if (!cpo) {
      throw notFound("CPO");
    }
    return cpo.stations;
  }

  async function upsertStation(cpoId, stationId, patch) {
    const cpo = store.getCpoById(cpoId);
    if (!cpo) {
      throw notFound("CPO");
    }
    const station = getStation(cpo, stationId);
    Object.assign(station, patch);
    await store.save();
    eventBus.emit({
      scope: "STATION_EDIT",
      cpoId,
      payload: deepClone(station)
    });
    return station;
  }

  async function addStation(cpoId, station) {
    const cpo = store.getCpoById(cpoId);
    if (!cpo) {
      throw notFound("CPO");
    }
    const item = {
      id: station.id ?? createId("cs"),
      name: station.name ?? "New Station",
      position: station.position ?? { latitude: 0, longitude: 0 },
      address: station.address ?? "",
      district: station.district ?? "",
      status: station.status ?? 1,
      chargingPoints: Array.isArray(station.chargingPoints) ? station.chargingPoints : []
    };
    cpo.stations.push(item);
    await store.save();
    eventBus.emit({ scope: "STATION_ADD", cpoId, payload: deepClone(item) });
    return item;
  }

  async function removeStation(cpoId, stationId) {
    const cpo = store.getCpoById(cpoId);
    if (!cpo) {
      throw notFound("CPO");
    }
    const index = cpo.stations.findIndex((item) => item.id === stationId);
    if (index === -1) {
      throw notFound("Station");
    }
    const [removed] = cpo.stations.splice(index, 1);
    await store.save();
    eventBus.emit({ scope: "STATION_DELETE", cpoId, payload: { stationId } });
    return removed;
  }

  async function addChargePoint(cpoId, stationId, chargePoint) {
    const cpo = store.getCpoById(cpoId);
    if (!cpo) {
      throw notFound("CPO");
    }
    const station = getStation(cpo, stationId);
    const item = {
      id: chargePoint.id ?? createId("cp"),
      status: chargePoint.status ?? 1,
      connectors: Array.isArray(chargePoint.connectors) ? chargePoint.connectors : []
    };
    station.chargingPoints.push(item);
    await store.save();
    eventBus.emit({
      scope: "CHARGEPOINT_ADD",
      cpoId,
      payload: { stationId, chargePoint: deepClone(item) }
    });
    return item;
  }

  async function removeChargePoint(cpoId, stationId, chargePointId) {
    const cpo = store.getCpoById(cpoId);
    if (!cpo) {
      throw notFound("CPO");
    }
    const station = getStation(cpo, stationId);
    const index = station.chargingPoints.findIndex((item) => item.id === chargePointId);
    if (index === -1) {
      throw notFound("Charge point");
    }
    const [removed] = station.chargingPoints.splice(index, 1);
    await store.save();
    eventBus.emit({
      scope: "CHARGEPOINT_DELETE",
      cpoId,
      payload: { stationId, chargePointId }
    });
    return removed;
  }

  async function addConnector(cpoId, stationId, chargePointId, connector) {
    const cpo = store.getCpoById(cpoId);
    if (!cpo) {
      throw notFound("CPO");
    }
    const station = getStation(cpo, stationId);
    const chargePoint = getChargePoint(station, chargePointId);
    const status = normalizeConnectorStatus(
      connector.status,
      typeof connector.isAvailable === "boolean"
        ? statusFromAvailability(connector.isAvailable)
        : getWeightedInitialConnectorStatus()
    );
    const item = {
      id: connector.id ?? createId("cn"),
      type: connector.type ?? 1,
      price: connector.price ?? 0,
      voltage: connector.voltage ?? 220,
      maxPower: connector.maxPower ?? 7.4,
      status,
      isAvailable: status === "AVAILABLE"
    };
    chargePoint.connectors.push(item);
    await store.save();
    eventBus.emit({
      scope: "CONNECTOR_ADD",
      cpoId,
      payload: { stationId, chargePointId, connector: deepClone(item) }
    });
    return item;
  }

  async function updateConnector(cpoId, stationId, chargePointId, connectorId, patch) {
    const cpo = store.getCpoById(cpoId);
    if (!cpo) {
      throw notFound("CPO");
    }
    const station = getStation(cpo, stationId);
    const chargePoint = getChargePoint(station, chargePointId);
    const connector = getConnector(chargePoint, connectorId);
    Object.assign(connector, patch);
    if (typeof patch.isAvailable === "boolean" && !patch.status) {
      connector.status = statusFromAvailability(patch.isAvailable);
    }
    if (patch.status) {
      connector.status = normalizeConnectorStatus(
        patch.status,
        statusFromAvailability(connector.isAvailable ?? true)
      );
    }
    syncConnectorStatusFields(connector);
    await store.save();
    eventBus.emit({
      scope: "CONNECTOR_EDIT",
      cpoId,
      payload: { stationId, chargePointId, connector: deepClone(connector) }
    });
    return connector;
  }

  async function removeConnector(cpoId, stationId, chargePointId, connectorId) {
    const cpo = store.getCpoById(cpoId);
    if (!cpo) {
      throw notFound("CPO");
    }
    const station = getStation(cpo, stationId);
    const chargePoint = getChargePoint(station, chargePointId);
    const index = chargePoint.connectors.findIndex((item) => item.id === connectorId);
    if (index === -1) {
      throw notFound("Connector");
    }
    const [removed] = chargePoint.connectors.splice(index, 1);
    await store.save();
    eventBus.emit({
      scope: "CONNECTOR_DELETE",
      cpoId,
      payload: { stationId, chargePointId, connectorId }
    });
    return removed;
  }

  function ensurePayload(eventType, payload) {
    if (!EVENT_TYPES.includes(eventType)) {
      const error = new Error("eventType is invalid");
      error.status = 400;
      throw error;
    }
    if (typeof payload !== "object" || payload === null) {
      const error = new Error("payload is required");
      error.status = 400;
      throw error;
    }
  }

  async function applyEventMutation(cpoId, eventType, payload) {
    const cpo = store.getCpoById(cpoId);
    if (!cpo) {
      throw notFound("CPO");
    }
    ensurePayload(eventType, payload);

    switch (eventType) {
      case "STATION_ADD": {
        const station = payload.station ?? createRandomStation(cpoId);
        cpo.stations.push(station);
        break;
      }
      case "STATION_CHANGE": {
        if (!payload.station?.id) {
          throw new Error("payload.station.id is required");
        }
        const station = getStation(cpo, payload.station.id);
        Object.assign(station, payload.station);
        break;
      }
      case "STATION_DELETE": {
        const stationId = payload.stationId;
        const index = cpo.stations.findIndex((item) => item.id === stationId);
        if (index === -1) {
          throw notFound("Station");
        }
        cpo.stations.splice(index, 1);
        break;
      }
      case "CHARGEPOINT_ADD": {
        const station = getStation(cpo, payload.stationId);
        station.chargingPoints.push(
          payload.chargePoint ?? createRandomChargePoint(payload.stationId)
        );
        break;
      }
      case "CHARGEPOINT_DELETE": {
        let removed = false;
        for (const station of cpo.stations) {
          const index = station.chargingPoints.findIndex(
            (item) => item.id === payload.chargePointId
          );
          if (index !== -1) {
            station.chargingPoints.splice(index, 1);
            removed = true;
            break;
          }
        }
        if (!removed) {
          throw notFound("Charge point");
        }
        break;
      }
      case "CONNECTOR_ADD": {
        const station = getStation(cpo, payload.stationId);
        const chargePoint = getChargePoint(station, payload.chargePointId);
        const connector = payload.connector ?? createRandomConnector(payload.chargePointId);
        syncConnectorStatusFields(connector);
        chargePoint.connectors.push(connector);
        break;
      }
      case "CONNECTOR_EDIT": {
        const station = getStation(cpo, payload.stationId);
        const chargePoint = getChargePoint(station, payload.chargePointId);
        if (!payload.connector?.id) {
          throw new Error("payload.connector.id is required");
        }
        const connector = getConnector(chargePoint, payload.connector.id);
        Object.assign(connector, payload.connector);
        if (typeof payload.connector.isAvailable === "boolean" && !payload.connector.status) {
          connector.status = statusFromAvailability(payload.connector.isAvailable);
        }
        if (payload.connector.status) {
          connector.status = normalizeConnectorStatus(
            payload.connector.status,
            statusFromAvailability(connector.isAvailable ?? true)
          );
        }
        syncConnectorStatusFields(connector);
        break;
      }
      case "CONNECTOR_EDIT_STATUS": {
        if (!payload.connectorId) {
          throw new Error("payload.connectorId is required");
        }
        const status = normalizeConnectorStatus(payload.status, "");
        if (!status) {
          throw new Error(`payload.status must be one of: ${CONNECTOR_STATUSES.join(", ")}`);
        }
        const connector = findConnectorInCpoById(cpo, payload.connectorId);
        if (!connector) {
          throw notFound("Connector");
        }
        connector.status = status;
        syncConnectorStatusFields(connector);
        break;
      }
      case "CONNECTOR_DELETE": {
        let removed = false;
        for (const station of cpo.stations) {
          for (const chargePoint of station.chargingPoints) {
            const index = chargePoint.connectors.findIndex(
              (item) => item.id === payload.connectorId
            );
            if (index !== -1) {
              chargePoint.connectors.splice(index, 1);
              removed = true;
              break;
            }
          }
          if (removed) {
            break;
          }
        }
        if (!removed) {
          throw notFound("Connector");
        }
        break;
      }
      default:
        break;
    }

    await store.save();
    return cpo;
  }

  function generateRandomEventPayload(cpo) {
    const eventType = randomItem(EVENT_TYPES);

    if (!hasStations(cpo) || eventType === "STATION_ADD") {
      const newStation = createRandomStation(cpo.id);
      const cp = createRandomChargePoint(newStation.id);
      cp.connectors = [createRandomConnector(cp.id)];
      newStation.chargingPoints = [cp];
      return {
        eventType: "STATION_ADD",
        payload: { station: createStationPayload(newStation) }
      };
    }

    const station = randomItem(cpo.stations);
    const chargePoint = randomItem(station.chargingPoints);
    const connector = chargePoint ? randomItem(chargePoint.connectors) : null;

    switch (eventType) {
      case "STATION_CHANGE":
        return {
          eventType,
          payload: {
            station: {
              id: station.id,
              name: `${station.name} (updated)`,
              position: {
                latitude: station.position?.latitude ?? 0,
                longitude: station.position?.longitude ?? 0
              },
              address: station.address ?? "",
              district: station.district ?? "",
              status: randomInt(0, 1)
            }
          }
        };
      case "STATION_DELETE":
        return { eventType, payload: { stationId: station.id } };
      case "CHARGEPOINT_ADD":
        {
          const newChargePoint = createRandomChargePoint(station.id);
          newChargePoint.connectors = [createRandomConnector(newChargePoint.id)];
          return {
            eventType,
            payload: {
              stationId: station.id,
              chargePoint: newChargePoint
            }
          };
        }
      case "CHARGEPOINT_DELETE":
        if (!chargePoint) {
          return {
            eventType: "CHARGEPOINT_ADD",
            payload: {
              stationId: station.id,
              chargePoint: createRandomChargePoint(station.id)
            }
          };
        }
        return { eventType, payload: { chargePointId: chargePoint.id } };
      case "CONNECTOR_ADD":
        if (!chargePoint) {
          const cpForFallback = createRandomChargePoint(station.id);
          cpForFallback.connectors = [createRandomConnector(cpForFallback.id)];
          return {
            eventType: "CHARGEPOINT_ADD",
            payload: {
              stationId: station.id,
              chargePoint: cpForFallback
            }
          };
        }
        return {
          eventType,
          payload: {
            stationId: station.id,
            chargePointId: chargePoint.id,
            connector: createRandomConnector(chargePoint.id)
          }
        };
      case "CONNECTOR_EDIT": {
        if (!chargePoint || !connector) {
          return {
            eventType: "CONNECTOR_ADD",
            payload: {
              stationId: station.id,
              chargePointId: chargePoint?.id ?? createId("cp"),
              connector: createRandomConnector(chargePoint?.id ?? createId("cp"))
            }
          };
        }
        const connectorStatus = normalizeConnectorStatus(
          connector.status,
          statusFromAvailability(connector.isAvailable ?? true)
        );
        const nextStatus =
          connectorStatus === "AVAILABLE"
            ? "IN_USE"
            : connectorStatus === "IN_USE"
              ? "AVAILABLE"
              : "AVAILABLE";
        return {
          eventType,
          payload: {
            stationId: station.id,
            chargePointId: chargePoint.id,
            connector: {
              ...connector,
              price: connector.price + randomInt(50, 250),
              status: nextStatus,
              isAvailable: nextStatus === "AVAILABLE"
            }
          }
        };
      }
      case "CONNECTOR_DELETE":
        if (!connector) {
          return {
            eventType: "CONNECTOR_ADD",
            payload: {
              stationId: station.id,
              chargePointId: chargePoint?.id ?? createId("cp"),
              connector: createRandomConnector(chargePoint?.id ?? createId("cp"))
            }
          };
        }
        return { eventType, payload: { connectorId: connector.id } };
      default:
        return {
          eventType: "STATION_CHANGE",
          payload: { station: { id: station.id, status: randomInt(0, 1) } }
        };
    }
  }

  function generateRandomConnectorStatusPayload(cpo) {
    const context = pickRandomConnectorContext(cpo);
    if (!context) {
      return null;
    }
    const { connector } = context;
    const normalizedStatus = normalizeConnectorStatus(
      connector.status,
      statusFromAvailability(connector.isAvailable ?? true)
    );
    return {
      eventType: "CONNECTOR_EDIT_STATUS",
      payload: {
        connectorId: connector.id,
        status: pickNextConnectorStatus(normalizedStatus)
      }
    };
  }

  async function dispatchEvent(cpoId, eventType, payload, meta = { source: "manual" }) {
    const cpo = store.getCpoById(cpoId);
    if (!cpo) {
      throw notFound("CPO");
    }
    await applyEventMutation(cpoId, eventType, payload);
    const outbound = await dispatchEventToRemote(cpo, eventType, payload);
    eventBus.emit({
      scope: "EVENT_DISPATCH",
      cpoId,
      source: meta.source,
      payload: { eventType, payload },
      outbound
    });
    return outbound;
  }

  async function authLogin(cpoId, credentials) {
    const cpo = store.getCpoById(cpoId);
    if (!cpo) {
      throw notFound("CPO");
    }
    const authUrl = buildUrl(cpo.baseUrl, "/auth/login");
    if (!authUrl) {
      throw new Error("baseUrl is required");
    }

    const body = {
      username: credentials?.username ?? cpo.username,
      password: credentials?.password ?? cpo.password
    };

    // eslint-disable-next-line no-console
    console.log(
      `[BE][OUTBOUND][AUTH][REQUEST] url=${authUrl} (derived from baseUrl=${cpo.baseUrl})`
    );
    // eslint-disable-next-line no-console
    console.log("[BE][OUTBOUND][AUTH][PAYLOAD]", JSON.stringify(body, null, 2));

    const response = await fetch(authUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    // eslint-disable-next-line no-console
    console.log(
      "[BE][OUTBOUND][AUTH][RESPONSE]",
      JSON.stringify(
        {
          url: authUrl,
          status: response.status,
          ok: response.ok,
          body: data
        },
        null,
        2
      )
    );
    if (!response.ok) {
      const error = new Error(data?.message ?? "Auth request failed");
      error.status = response.status;
      throw error;
    }

    const token = data?.responseData?.token ?? "";
    const user = data?.responseData?.user ?? null;
    const expiresIn = data?.expiresIn ?? null;
    if (!token) {
      const error = new Error("responseData.token is missing");
      error.status = 502;
      throw error;
    }

    await store.updateCpo(cpoId, {
      authSession: {
        token,
        expiresIn,
        user,
        updatedAt: new Date().toISOString()
      }
    });

    eventBus.emit({
      scope: "AUTH_LOGIN",
      cpoId,
      payload: {
        request: body,
        response: { token, user, expiresIn }
      }
    });
    return { token, user, expiresIn };
  }

  return {
    listCpos,
    createCpo,
    updateCpo,
    deleteCpo,
    getCpoStations,
    addStation,
    upsertStation,
    removeStation,
    addChargePoint,
    removeChargePoint,
    addConnector,
    updateConnector,
    removeConnector,
    authLogin,
    dispatchEvent,
    applyEventMutation,
    generateRandomEventPayload,
    generateRandomConnectorStatusPayload
  };
}
