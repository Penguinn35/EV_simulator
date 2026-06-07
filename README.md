# OCPI Public Simulator (Node.js + React)

Simulator API custom cho luong test OCPI don gian:
- Quan ly nhieu CPO rieng biet
- 3 API chinh: auth / get stations / post event
- CRUD station, charge point, connector
- SSE realtime console
- Simulator random event moi 1 giay

## 1) Setup

```bash
npm install
cp .env.example .env
```

## 2) Chay local

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`

## 2.1) Build va start de deploy

```bash
npm run build
npm run start
```

- Sau khi `build`, frontend static duoc tao tai `Frontend/dist`.
- `start` se chay backend va serve frontend build tren cung 1 port (`PORT`, mac dinh `3000`).

## 3) Data seed

He thong doc tu:
- `Backend/sampleData.txt`
- `Backend/stationType.json`
- `Backend/generate.txt`

Khi tao CPO moi:
- Lay cac station co `cpo_id` trung voi `id` CPO moi
- Tu dong sinh charge point + connector theo rule trong `Backend/generate.txt`

## 4) API chinh

### 4.1 Auth API

`POST /api/cpos/:cpoId/auth/login`

Request:
```json
{
  "username": "demo",
  "password": "demo"
}
```

Response:
```json
{
  "data": {
    "token": "abc",
    "user": {
      "username": "business-owner"
    },
    "expiresIn": null
  }
}
```

Luu y:
- CPO chi can cau hinh `baseUrl`.
- Backend tu dong goi login toi `<baseUrl>/auth/login`.

### 4.2 Get stations API (bao ve bang static token)

`GET /api/cpos/:cpoId/stations`

Header:
```http
Authorization: Bearer <CPO_TOKEN>
```

Rule token:
- Neu CPO co `token` trong config -> dung token do.
- Neu CPO chua set `token` -> fallback sang `STATIC_TOKEN` tu `.env`.

### 4.3 Post event API

`POST /api/cpos/:cpoId/events/dispatch`

Request:
```json
{
  "eventType": "STATION_CHANGE",
  "payload": {
    "station": {
      "id": "cs-vn-1001",
      "status": 0
    }
  }
}
```

Behavior:
- Mutate local data
- Forward event sang `<baseUrl>/api/business/stations/events`
- Tu dong gui `Authorization: Bearer <token>` lay tu auth login
- Neu outbound bi `401/403` -> map thanh `404`
- Loi outbound khac -> tra `fail`

## 5) API quan tri cho FE

- `GET /api/cpos`
- `POST /api/cpos`
- `PUT /api/cpos/:cpoId`
- `DELETE /api/cpos/:cpoId`
- `GET /api/cpos/:cpoId/stations/admin`
- `POST /api/cpos/:cpoId/stations`
- `PUT /api/cpos/:cpoId/stations/:stationId`
- `DELETE /api/cpos/:cpoId/stations/:stationId`
- `POST /api/cpos/:cpoId/stations/:stationId/charge-points`
- `DELETE /api/cpos/:cpoId/stations/:stationId/charge-points/:chargePointId`
- `POST /api/cpos/:cpoId/stations/:stationId/charge-points/:chargePointId/connectors`
- `PUT /api/cpos/:cpoId/stations/:stationId/charge-points/:chargePointId/connectors/:connectorId`
- `DELETE /api/cpos/:cpoId/stations/:stationId/charge-points/:chargePointId/connectors/:connectorId`
- `POST /api/cpos/:cpoId/simulator/start`
- `POST /api/cpos/:cpoId/simulator/stop`
- `GET /api/stream/events?cpoId=<id>`

## 6) Test

```bash
npm run test --workspace backend
```

Test focus:
- Event mutation
- Outbound forbidden mapping
- Auth token parsing
