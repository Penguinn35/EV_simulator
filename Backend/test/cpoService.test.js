import test from "node:test";
import assert from "node:assert/strict";
import { createCpoService } from "../src/services/cpoService.js";

function createFakeDependencies() {
  const state = {
    cpos: [
      {
        id: "cpo-vgreen",
        name: "VGreen",
        baseUrl: "http://localhost",
        username: "demo",
        password: "demo",
        authSession: { token: "session-token" },
        stations: [
          {
            id: "cs-1",
            name: "Station 1",
            position: { latitude: 10, longitude: 106 },
            address: "A",
            district: "D1",
            status: 1,
            chargingPoints: [
              {
                id: "cp-1",
                status: 1,
                connectors: [
                  {
                    id: "cn-1",
                    type: 1,
                    price: 3000,
                    voltage: 400,
                    maxPower: 22,
                    status: "AVAILABLE",
                    isAvailable: true
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  };

  const store = {
    getCpos() {
      return state.cpos;
    },
    getCpoById(cpoId) {
      return state.cpos.find((item) => item.id === cpoId) ?? null;
    },
    async createCpo(payload) {
      state.cpos.push(payload);
      return payload;
    },
    async updateCpo(cpoId, patch) {
      const cpo = this.getCpoById(cpoId);
      if (!cpo) return null;
      Object.assign(cpo, patch);
      return cpo;
    },
    async deleteCpo(cpoId) {
      const index = state.cpos.findIndex((item) => item.id === cpoId);
      if (index < 0) return false;
      state.cpos.splice(index, 1);
      return true;
    },
    async save() {}
  };

  const events = [];
  const eventBus = {
    emit(event) {
      events.push(event);
      return event;
    }
  };

  return { store, eventBus, events };
}

test("applyEventMutation adds station", async () => {
  const { store, eventBus } = createFakeDependencies();
  const service = createCpoService({ store, eventBus });
  await service.applyEventMutation("cpo-vgreen", "STATION_ADD", {
    station: {
      id: "cs-new",
      name: "Station new",
      position: { latitude: 10.1, longitude: 106.1 },
      address: "New",
      district: "D2",
      status: 1,
      chargingPoints: []
    }
  });
  const cpo = store.getCpoById("cpo-vgreen");
  assert.equal(cpo.stations.some((item) => item.id === "cs-new"), true);
});

test("dispatchEvent maps forbidden to status 404", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({ ok: false, status: 403 });

  try {
    const { store, eventBus } = createFakeDependencies();
    const service = createCpoService({ store, eventBus });
    const result = await service.dispatchEvent(
      "cpo-vgreen",
      "STATION_CHANGE",
      { station: { id: "cs-1", status: 0 } },
      { source: "test" }
    );
    assert.equal(result.status, 404);
  } finally {
    global.fetch = originalFetch;
  }
});

test("applyEventMutation updates connector status by connectorId", async () => {
  const { store, eventBus } = createFakeDependencies();
  const service = createCpoService({ store, eventBus });
  await service.applyEventMutation("cpo-vgreen", "CONNECTOR_EDIT_STATUS", {
    connectorId: "cn-1",
    status: "IN_USE"
  });
  const connector =
    store.getCpoById("cpo-vgreen").stations[0].chargingPoints[0].connectors[0];
  assert.equal(connector.status, "IN_USE");
  assert.equal(connector.isAvailable, false);
});

test("authLogin reads token and expiresIn", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    status: 200,
    async json() {
      return {
        httpStatus: "OK",
        message: "Successfully return token and user info",
        responseData: {
          token: "abc-token",
          user: { username: "demo-user", role: "BUSINESS" }
        },
        objectCount: 1
      };
    }
  });

  try {
    const { store, eventBus } = createFakeDependencies();
    const service = createCpoService({ store, eventBus });
    const result = await service.authLogin("cpo-vgreen", {
      username: "demo",
      password: "demo"
    });
    assert.equal(result.token, "abc-token");
    assert.equal(result.user.username, "demo-user");
  } finally {
    global.fetch = originalFetch;
  }
});
