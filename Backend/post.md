- tạo api post, gọi tới url được set
- nếu gọi tới thất bại vì forbiden thì trả về 404
- nếu vì lý do khác thì trả về fail
# body
{
  "eventType": "STATION_ADD",
  "payload": {}
}
# event
STATION_ADD
STATION_CHANGE
STATION_DELETE
CHARGEPOINT_ADD
CHARGEPOINT_DELETE
CONNECTOR_ADD
CONNECTOR_EDIT
CONNECTOR_DELETE

Định nghĩa payload cơ bản theo từng event
A. STATION_ADD / STATION_CHANGE

{
  "eventType": "STATION_ADD",
  "payload": {
    "station": {
      "id": "station-001",
      "name": "EV Hub Q1",
      "position": {
        "latitude": 10.7769,
        "longitude": 106.7009
      },
      "address": "1 Le Loi, Q1, HCM",
      "district": "District 1",
      "chargingPoints": [
        {
          "id": "cp-001",
          "status": 1,
          "connectors": [
            {
              "id": "conn-001",
              "type": 1,
              "price": 3500.0,
              "voltage": 400.0,
              "maxPower": 120.0,
              "isAvailable": true
            }
          ]
        }
      ]
    }
  }
}
Rule tối thiểu:

STATION_ADD: nên yêu cầu đầy đủ station.id,name,position,address,district (và tùy chọn chargingPoints)
STATION_CHANGE: bắt buộc station.id, các field còn lại cho phép partial update (theo logic non-null của service hiện tại)
B. CHARGEPOINT_ADD

{
  "eventType": "CHARGEPOINT_ADD",
  "payload": {
    "stationId": "station-001",
    "chargePoint": {
      "id": "cp-002",
      "status": 1,
      "connectors": [
        {
          "id": "conn-010",
          "type": 2,
          "price": 3200.0,
          "voltage": 380.0,
          "maxPower": 60.0,
          "isAvailable": true
        }
      ]
    }
  }
}
C. CONNECTOR_ADD / CONNECTOR_EDIT

{
  "eventType": "CONNECTOR_EDIT",
  "payload": {
    "stationId": "station-001",
    "chargePointId": "cp-001",
    "connector": {
      "id": "conn-001",
      "type": 1,
      "price": 3600.0,
      "voltage": 400.0,
      "maxPower": 150.0,
      "isAvailable": false
    }
  }
}


D. CONNECTOR_DELETE


{
  "eventType": "CONNECTOR_DELETE",
  "payload": {
    "connectorId": "conn-001"
  }
}


STATION_DELETE

{
  "eventType": "STATION_DELETE",
  "payload": {
    "stationId": "station-001"
  }
}
CHARGEPOINT_DELETE


{
  "eventType": "CHARGEPOINT_DELETE",
  "payload": {
    "chargePointId": "cp-001"
  }
}