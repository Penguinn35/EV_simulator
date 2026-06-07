import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { loadSeedData } from "./seed/loadSeedData.js";
import { createDataStore } from "./store/dataStore.js";
import { createCpoService } from "./services/cpoService.js";
import { createEventBus } from "./services/eventBus.js";
import { createSimulatorService } from "./services/simulatorService.js";

dotenv.config();

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

const seedData = await loadSeedData();
const store = await createDataStore(seedData);
const eventBus = createEventBus();
const cpoService = createCpoService({ store, eventBus });
const simulatorService = createSimulatorService({ store, cpoService, eventBus });

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
    const station = await cpoService.addStation(req.params.cpoId, req.body);
    res.status(201).json({ data: station });
  } catch (error) {
    next(error);
  }
});

app.put("/api/cpos/:cpoId/stations/:stationId", async (req, res, next) => {
  try {
    const station = await cpoService.upsertStation(
      req.params.cpoId,
      req.params.stationId,
      req.body
    );
    res.json({ data: station });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/cpos/:cpoId/stations/:stationId", async (req, res, next) => {
  try {
    await cpoService.removeStation(req.params.cpoId, req.params.stationId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.post(
  "/api/cpos/:cpoId/stations/:stationId/charge-points",
  async (req, res, next) => {
    try {
      const chargePoint = await cpoService.addChargePoint(
        req.params.cpoId,
        req.params.stationId,
        req.body
      );
      res.status(201).json({ data: chargePoint });
    } catch (error) {
      next(error);
    }
  }
);

app.delete(
  "/api/cpos/:cpoId/stations/:stationId/charge-points/:chargePointId",
  async (req, res, next) => {
    try {
      await cpoService.removeChargePoint(
        req.params.cpoId,
        req.params.stationId,
        req.params.chargePointId
      );
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

app.post(
  "/api/cpos/:cpoId/stations/:stationId/charge-points/:chargePointId/connectors",
  async (req, res, next) => {
    try {
      const connector = await cpoService.addConnector(
        req.params.cpoId,
        req.params.stationId,
        req.params.chargePointId,
        req.body
      );
      res.status(201).json({ data: connector });
    } catch (error) {
      next(error);
    }
  }
);

app.put(
  "/api/cpos/:cpoId/stations/:stationId/charge-points/:chargePointId/connectors/:connectorId",
  async (req, res, next) => {
    try {
      const connector = await cpoService.updateConnector(
        req.params.cpoId,
        req.params.stationId,
        req.params.chargePointId,
        req.params.connectorId,
        req.body
      );
      res.json({ data: connector });
    } catch (error) {
      next(error);
    }
  }
);

app.delete(
  "/api/cpos/:cpoId/stations/:stationId/charge-points/:chargePointId/connectors/:connectorId",
  async (req, res, next) => {
    try {
      await cpoService.removeConnector(
        req.params.cpoId,
        req.params.stationId,
        req.params.chargePointId,
        req.params.connectorId
      );
      res.status(204).send();
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

app.use((error, _req, res, _next) => {
  const status = error.status ?? 500;
  res.status(status).json({
    message: error.message ?? "Unexpected error"
  });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend running on http://localhost:${PORT}`);
});
