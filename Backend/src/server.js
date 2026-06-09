import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadSeedData } from "./seed/loadSeedData.js";
import { createDataStore } from "./store/dataStore.js";
import { createMongoDataStore } from "./store/mongoDataStore.js";
import { createCpoService } from "./services/cpoService.js";
import { createEventBus } from "./services/eventBus.js";
import { createSimulatorService } from "./services/simulatorService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootEnvPath = path.resolve(__dirname, "..", "..", ".env");
dotenv.config({ path: rootEnvPath });

const frontendDistCandidates = [
  path.resolve(__dirname, "..", "..", "Frontend", "dist"),
  path.resolve(__dirname, "..", "..", "frontend", "dist"),
  path.resolve(__dirname, "..", "dist"),
  path.resolve(process.cwd(), "Frontend", "dist"),
  path.resolve(process.cwd(), "frontend", "dist"),
  path.resolve(process.cwd(), "dist")
];

const frontendDistPath = frontendDistCandidates.find((candidate) =>
  fs.existsSync(candidate)
);
const hasFrontendBuild = Boolean(frontendDistPath);

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  const startedAt = Date.now();
  const requestLog = {
    method: req.method,
    path: req.originalUrl,
    params: req.params,
    query: req.query,
    body: req.body
  };

  const originalJson = res.json.bind(res);
  let responsePayload = null;

  res.json = (payload) => {
    responsePayload = payload;
    return originalJson(payload);
  };

  res.on("finish", () => {
    const responseLog = {
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
      response: responsePayload
    };
  });

  next();
});

const PORT = Number(process.env.PORT ?? 3000);
const STATIC_TOKEN = process.env.STATIC_TOKEN ?? "ocpi-static-token";
const MONGODB_URI = process.env.MONGODB_URI?.trim();

const seedData = await loadSeedData();
const store = MONGODB_URI
  ? await createMongoDataStore(seedData)
  : await createDataStore(seedData);
const eventBus = createEventBus();
const cpoService = createCpoService({ store, eventBus });
const simulatorService = createSimulatorService({ store, cpoService, eventBus });

function getCpoOrThrow(cpoId) {
  const cpo = store.getCpoById(cpoId);
  if (!cpo) {
    const error = new Error("CPO not found");
    error.status = 404;
    throw error;
  }
  return cpo;
}

function getStationOrThrow(cpoId, stationId) {
  const cpo = getCpoOrThrow(cpoId);
  const station = cpo.stations.find((item) => item.id === stationId);
  if (!station) {
    const error = new Error("Station not found");
    error.status = 404;
    throw error;
  }
  return station;
}

function getChargePointOrThrow(cpoId, stationId, chargePointId) {
  const station = getStationOrThrow(cpoId, stationId);
  const chargePoint = station.chargingPoints.find((item) => item.id === chargePointId);
  if (!chargePoint) {
    const error = new Error("Charge point not found");
    error.status = 404;
    throw error;
  }
  return chargePoint;
}

function getConnectorOrThrow(cpoId, stationId, chargePointId, connectorId) {
  const chargePoint = getChargePointOrThrow(cpoId, stationId, chargePointId);
  const connector = chargePoint.connectors.find((item) => item.id === connectorId);
  if (!connector) {
    const error = new Error("Connector not found");
    error.status = 404;
    throw error;
  }
  return connector;
}

function buildId(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function ensureOutboundOkOrThrow(outbound) {
  if (outbound.status === 404 && outbound.message?.includes("forbidden")) {
    const error = new Error("forbidden mapped to 404");
    error.status = 404;
    throw error;
  }
  if (!outbound.ok) {
    const error = new Error("fail");
    error.status = 500;
    error.outbound = outbound;
    throw error;
  }
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/stream/events", (req, res) => {
  const cpoFilter = req.query.cpoId?.toString() ?? null;

  res.setHeader("content-type", "text/event-stream");
  res.setHeader("cache-control", "no-cache");
  res.setHeader("connection", "keep-alive");
  res.flushHeaders();

  const unsubscribe = eventBus.subscribe((event) => {
    if (cpoFilter && event.cpoId !== cpoFilter) {
      return;
    }
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  });

  const ping = setInterval(() => {
    res.write("event: ping\ndata: {}\n\n");
  }, 20000);

  req.on("close", () => {
    clearInterval(ping);
    unsubscribe();
    res.end();
  });
});

function requireCpoToken(req, res, next) {
  const cpoId = req.params.cpoId;
  const cpo = store.getCpoById(cpoId);
  if (!cpo) {
    return res.status(404).json({ message: "CPO not found" });
  }

  const expectedToken = cpo.token || STATIC_TOKEN;
  const authHeader = req.headers.authorization ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (token !== expectedToken) {
    return res.status(401).json({ message: "Unauthorized token" });
  }
  return next();
}

app.get("/api/cpos", (_req, res) => {
  res.json({ data: cpoService.listCpos() });
});

app.post("/api/cpos", async (req, res, next) => {
  try {
    const cpo = await cpoService.createCpo(req.body);
    res.status(201).json({ data: cpo });
  } catch (error) {
    next(error);
  }
});

app.put("/api/cpos/:cpoId", async (req, res, next) => {
  try {
    const cpo = await cpoService.updateCpo(req.params.cpoId, req.body);
    res.json({ data: cpo });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/cpos/:cpoId", async (req, res, next) => {
  try {
    await simulatorService.stop(req.params.cpoId);
    await cpoService.deleteCpo(req.params.cpoId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.post("/api/cpos/:cpoId/auth/login", async (req, res, next) => {
  try {
    const data = await cpoService.authLogin(req.params.cpoId, req.body);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

app.get("/api/cpos/:cpoId/stations", requireCpoToken, (req, res, next) => {
  try {
    const stations = cpoService.getCpoStations(req.params.cpoId);
    res.json({ data: stations });
  } catch (error) {
    next(error);
  }
});

app.post("/api/cpos/:cpoId/events/dispatch", async (req, res, next) => {
  try {
    const { eventType, payload } = req.body;
    const outbound = await cpoService.dispatchEvent(req.params.cpoId, eventType, payload);
    if (outbound.status === 404 && outbound.message.includes("forbidden")) {
      return res.status(404).json({ message: "forbidden mapped to 404" });
    }
    if (!outbound.ok) {
      return res.status(500).json({ message: "fail", outbound });
    }
    return res.json({ message: "success", outbound });
  } catch (error) {
    return next(error);
  }
});

app.get("/api/cpos/:cpoId/stations/admin", (req, res, next) => {
  try {
    const stations = cpoService.getCpoStations(req.params.cpoId);
    res.json({ data: stations });
  } catch (error) {
    next(error);
  }
});

app.post("/api/cpos/:cpoId/stations", async (req, res, next) => {
  try {
    const stationId = req.body.id ?? buildId("cs");
    const payload = {
      station: {
        id: stationId,
        name: req.body.name ?? "New Station",
        position: req.body.position ?? { latitude: 0, longitude: 0 },
        address: req.body.address ?? "",
        district: req.body.district ?? "",
        status: req.body.status ?? 1,
        chargingPoints: Array.isArray(req.body.chargingPoints) ? req.body.chargingPoints : []
      }
    };
    const outbound = await cpoService.dispatchEvent(
      req.params.cpoId,
      "STATION_ADD",
      payload,
      { source: "admin" }
    );
    ensureOutboundOkOrThrow(outbound);
    const station = getStationOrThrow(req.params.cpoId, payload.station.id);
    res.status(201).json({ data: station, outbound });
  } catch (error) {
    next(error);
  }
});

app.put("/api/cpos/:cpoId/stations/:stationId", async (req, res, next) => {
  try {
    const payload = {
      station: {
        id: req.params.stationId,
        ...req.body
      }
    };
    const outbound = await cpoService.dispatchEvent(
      req.params.cpoId,
      "STATION_CHANGE",
      payload,
      { source: "admin" }
    );
    ensureOutboundOkOrThrow(outbound);
    const station = getStationOrThrow(req.params.cpoId, req.params.stationId);
    res.json({ data: station, outbound });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/cpos/:cpoId/stations/:stationId", async (req, res, next) => {
  try {
    const outbound = await cpoService.dispatchEvent(
      req.params.cpoId,
      "STATION_DELETE",
      { stationId: req.params.stationId },
      { source: "admin" }
    );
    ensureOutboundOkOrThrow(outbound);
    res.json({ data: { stationId: req.params.stationId }, outbound });
  } catch (error) {
    next(error);
  }
});

app.post(
  "/api/cpos/:cpoId/stations/:stationId/charge-points",
  async (req, res, next) => {
    try {
      const chargePointId = req.body.id ?? buildId("cp");
      const payload = {
        stationId: req.params.stationId,
        chargePoint: {
          id: chargePointId,
          status: req.body.status ?? 1,
          connectors: Array.isArray(req.body.connectors) ? req.body.connectors : []
        }
      };
      const outbound = await cpoService.dispatchEvent(
        req.params.cpoId,
        "CHARGEPOINT_ADD",
        payload,
        { source: "admin" }
      );
      ensureOutboundOkOrThrow(outbound);
      const chargePoint = getChargePointOrThrow(
        req.params.cpoId,
        req.params.stationId,
        payload.chargePoint.id
      );
      res.status(201).json({ data: chargePoint, outbound });
    } catch (error) {
      next(error);
    }
  }
);

app.delete(
  "/api/cpos/:cpoId/stations/:stationId/charge-points/:chargePointId",
  async (req, res, next) => {
    try {
      const outbound = await cpoService.dispatchEvent(
        req.params.cpoId,
        "CHARGEPOINT_DELETE",
        { chargePointId: req.params.chargePointId },
        { source: "admin" }
      );
      ensureOutboundOkOrThrow(outbound);
      res.json({ data: { chargePointId: req.params.chargePointId }, outbound });
    } catch (error) {
      next(error);
    }
  }
);

app.post(
  "/api/cpos/:cpoId/stations/:stationId/charge-points/:chargePointId/connectors",
  async (req, res, next) => {
    try {
      const connectorId = req.body.id ?? buildId("cn");
      const payload = {
        stationId: req.params.stationId,
        chargePointId: req.params.chargePointId,
        connector: {
          id: connectorId,
          type: req.body.type ?? 1,
          price: req.body.price ?? 0,
          voltage: req.body.voltage ?? 220,
          maxPower: req.body.maxPower ?? 7.4,
          status: req.body.status,
          isAvailable: req.body.isAvailable
        }
      };
      const outbound = await cpoService.dispatchEvent(
        req.params.cpoId,
        "CONNECTOR_ADD",
        payload,
        { source: "admin" }
      );
      ensureOutboundOkOrThrow(outbound);
      const connector = getConnectorOrThrow(
        req.params.cpoId,
        req.params.stationId,
        req.params.chargePointId,
        payload.connector.id
      );
      res.status(201).json({ data: connector, outbound });
    } catch (error) {
      next(error);
    }
  }
);

app.put(
  "/api/cpos/:cpoId/stations/:stationId/charge-points/:chargePointId/connectors/:connectorId",
  async (req, res, next) => {
    try {
      const payload = {
        stationId: req.params.stationId,
        chargePointId: req.params.chargePointId,
        connector: {
          id: req.params.connectorId,
          ...req.body
        }
      };
      const outbound = await cpoService.dispatchEvent(
        req.params.cpoId,
        "CONNECTOR_EDIT",
        payload,
        { source: "admin" }
      );
      ensureOutboundOkOrThrow(outbound);
      const connector = getConnectorOrThrow(
        req.params.cpoId,
        req.params.stationId,
        req.params.chargePointId,
        req.params.connectorId
      );
      res.json({ data: connector, outbound });
    } catch (error) {
      next(error);
    }
  }
);

app.delete(
  "/api/cpos/:cpoId/stations/:stationId/charge-points/:chargePointId/connectors/:connectorId",
  async (req, res, next) => {
    try {
      const outbound = await cpoService.dispatchEvent(
        req.params.cpoId,
        "CONNECTOR_DELETE",
        { connectorId: req.params.connectorId },
        { source: "admin" }
      );
      ensureOutboundOkOrThrow(outbound);
      res.json({ data: { connectorId: req.params.connectorId }, outbound });
    } catch (error) {
      next(error);
    }
  }
);

app.post("/api/cpos/:cpoId/simulator/start", async (req, res, next) => {
  try {
    const data = await simulatorService.start(req.params.cpoId);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

app.post("/api/cpos/:cpoId/simulator/stop", async (req, res, next) => {
  try {
    const data = await simulatorService.stop(req.params.cpoId);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

if (hasFrontendBuild) {
  app.use(express.static(frontendDistPath));

  app.get(/^\/(?!api).*/, (_req, res) => {
    res.sendFile(path.join(frontendDistPath, "index.html"));
  });
} else {
  app.get("/", (_req, res) => {
    res.status(200).json({
      message:
        "Backend is running but frontend build is missing. Run `npm run build` before start.",
      checkedPaths: frontendDistCandidates
    });
  });
}

app.use((error, _req, res, _next) => {
  const status = error.status ?? 500;
  res.status(status).json({
    message: error.message ?? "Unexpected error"
  });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend running on http://localhost:${PORT}`);
  // eslint-disable-next-line no-console
  console.log(
    hasFrontendBuild
      ? `[BE] Serving frontend from: ${frontendDistPath}`
      : `[BE] Frontend build not found. Checked: ${frontendDistCandidates.join(", ")}`
  );
});
