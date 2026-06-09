import { createId, ensureArray, nowIso } from "../utils.js";
import { getMongoDb } from "../db/mongoClient.js";

const META_DOC_ID = "store";

function createEmptyState(seed) {
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

function normalizeLegacyCpo(cpo) {
  return {
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

export async function createMongoDataStore(seed) {
  const db = await getMongoDb();
  const cposCollection = db.collection("cpos");
  const metadataCollection = db.collection("store_metadata");

  await cposCollection.createIndex({ id: 1 }, { unique: true });

  const [metaDoc, cpoDocs] = await Promise.all([
    metadataCollection.findOne({ _id: META_DOC_ID }),
    cposCollection.find({}).toArray()
  ]);

  const data = {
    ...(metaDoc?.state ?? createEmptyState(seed)),
    cpos: ensureArray(cpoDocs).map(normalizeLegacyCpo)
  };
  const migratedConnectorStatus = normalizeConnectorTree(data.cpos);

  async function syncStateToMongo() {
    data.meta.updatedAt = nowIso();

    const cpoIds = data.cpos.map((cpo) => cpo.id);
    const writes = data.cpos.map((cpo) => ({
      replaceOne: {
        filter: { id: cpo.id },
        replacement: { ...cpo, updatedAt: cpo.updatedAt ?? nowIso() },
        upsert: true
      }
    }));

    await Promise.all([
      writes.length > 0 ? cposCollection.bulkWrite(writes, { ordered: false }) : Promise.resolve(),
      cpoIds.length > 0
        ? cposCollection.deleteMany({ id: { $nin: cpoIds } })
        : cposCollection.deleteMany({}),
      metadataCollection.updateOne(
        { _id: META_DOC_ID },
        { $set: { state: { ...data, cpos: [] } } },
        { upsert: true }
      )
    ]);
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

  function getState() {
    return data;
  }

  function getCpos() {
    return ensureArray(data.cpos);
  }

  function getCpoById(cpoId) {
    return getCpos().find((item) => item.id === cpoId) ?? null;
  }

  async function save() {
    await syncStateToMongo();
  }

  if (migratedConnectorStatus) {
    await save();
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
