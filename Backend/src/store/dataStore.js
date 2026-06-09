import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createId, ensureArray, nowIso } from "../utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "..", "..", "data");
const STORE_PATH = path.join(DATA_DIR, "store.json");

function createEmptyStore(seed) {
  return {
    meta: {
      createdAt: nowIso(),
      updatedAt: nowIso()
    },
    config: {
      generateRules: seed.generateRules
    },
    seedData: {
      sampleData: seed.sampleData,
      stationType: seed.stationType
    },
    cpos: []
  };
}

function normalizeConnectorStatus(status, isAvailable) {
  if (typeof status === "string") {
    const normalized = status.trim().toUpperCase();
    if (["OFFLINE", "AVAILABLE", "MAINTENANCE", "IN_USE"].includes(normalized)) {
      return normalized;
    }
  }
  if (typeof isAvailable === "boolean") {
    return isAvailable ? "AVAILABLE" : "IN_USE";
  }
  return "AVAILABLE";
}

function getWeightedInitialConnectorStatus() {
  return Math.random() < 0.7 ? "AVAILABLE" : "IN_USE";
}

function normalizeConnectorTree(cpos) {
  let changed = false;
  for (const cpo of ensureArray(cpos)) {
    for (const station of ensureArray(cpo.stations)) {
      for (const chargePoint of ensureArray(station.chargingPoints)) {
        for (const connector of ensureArray(chargePoint.connectors)) {
          const nextStatus = normalizeConnectorStatus(connector.status, connector.isAvailable);
          const nextAvailable = nextStatus === "AVAILABLE";
          if (connector.status !== nextStatus || connector.isAvailable !== nextAvailable) {
            connector.status = nextStatus;
            connector.isAvailable = nextAvailable;
            changed = true;
          }
        }
      }
    }
  }
  return changed;
}

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

export async function createDataStore(seed) {
  await ensureDataDir();

  let data = null;
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    data = JSON.parse(raw);
  } catch {
    data = createEmptyStore(seed);
    await fs.writeFile(STORE_PATH, JSON.stringify(data, null, 2), "utf8");
  }

  // Backward compatibility for old schema fields (authUrl/eventPostUrl).
  data.cpos = ensureArray(data.cpos).map((cpo) => ({
    ...cpo,
    baseUrl:
      cpo.baseUrl ??
      cpo.authUrl?.replace(/\/auth\/login\/?$/i, "") ??
      cpo.eventPostUrl?.replace(/\/api\/business\/stations\/events\/?$/i, "") ??
      "",
    authSession: {
      token: cpo.authSession?.token ?? "",
      expiresIn: cpo.authSession?.expiresIn ?? null,
      user: cpo.authSession?.user ?? null,
      updatedAt: cpo.authSession?.updatedAt ?? null
    }
  }));
  const migratedConnectorStatus = normalizeConnectorTree(data.cpos);

  async function save() {
    data.meta.updatedAt = nowIso();
    await fs.writeFile(STORE_PATH, JSON.stringify(data, null, 2), "utf8");
  }

  function getState() {
    return data;
  }

  function getCpos() {
    return ensureArray(data.cpos);
  }

  function getCpoById(cpoId) {
    return getCpos().find((item) => item.id === cpoId) ?? null;
  }

  function buildConnector(baseId, cpoId) {
    const profile =
      data.config.generateRules.connectorProfileByCpo[cpoId] ?? {
        maxPower: 50,
        price: 3000,
        type: 1,
        voltage: 400
      };
    const status = getWeightedInitialConnectorStatus();
    return {
      id: baseId,
      type: profile.type,
      price: profile.price,
      voltage: profile.voltage,
      maxPower: profile.maxPower,
      status,
      isAvailable: status === "AVAILABLE"
    };
  }

  function buildChargePoint(stationId, index, cpoId) {
    const cpId = `${stationId.replace("cs-", "cp-")}-${String(index + 1).padStart(2, "0")}`;
    const connectors = Array.from(
      { length: data.config.generateRules.connectorsPerChargePoint },
      (_, connectorIndex) =>
        buildConnector(
          `${cpId.replace("cp-", "cn-")}-${connectorIndex + 1}`,
          cpoId
        )
    );

    return {
      id: cpId,
      status: 1,
      connectors
    };
  }

  function createStationsForCpo(cpoId) {
    const matches = data.seedData.sampleData.filter((item) => item.cpoId === cpoId);
    return matches.map((item) => ({
      id: item.id,
      name: item.name,
      position: {
        latitude: item.latitude,
        longitude: item.longitude
      },
      address: item.address,
      district: item.district,
      status: item.status,
      chargingPoints: Array.from(
        { length: data.config.generateRules.chargePointsPerStation },
        (_, index) => buildChargePoint(item.id, index, cpoId)
      )
    }));
  }

  async function createCpo(input) {
    const now = nowIso();
    const cpo = {
      id: input.id ?? createId("cpo"),
      name: input.name,
      token: input.token ?? createId("token"),
      baseUrl: input.baseUrl ?? "",
      username: input.username ?? "",
      password: input.password ?? "",
      authSession: {
        token: "",
        expiresIn: null,
        user: null,
        updatedAt: null
      },
      simulatorStatus: "stopped",
      createdAt: now,
      updatedAt: now,
      stations: []
    };

    cpo.stations = createStationsForCpo(cpo.id);
    data.cpos.push(cpo);
    await save();
    return cpo;
  }

  if (migratedConnectorStatus) {
    await save();
  }

  async function updateCpo(cpoId, patch) {
    const cpo = getCpoById(cpoId);
    if (!cpo) {
      return null;
    }
    Object.assign(cpo, patch, { updatedAt: nowIso() });
    await save();
    return cpo;
  }

  async function deleteCpo(cpoId) {
    const index = getCpos().findIndex((item) => item.id === cpoId);
    if (index === -1) {
      return false;
    }
    data.cpos.splice(index, 1);
    await save();
    return true;
  }

  return {
    getState,
    getCpos,
    getCpoById,
    createCpo,
    updateCpo,
    deleteCpo,
    save
  };
}
