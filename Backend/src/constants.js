export const EVENT_TYPES = [
  "STATION_ADD",
  "STATION_CHANGE",
  "STATION_DELETE",
  "CHARGEPOINT_ADD",
  "CHARGEPOINT_DELETE",
  "CONNECTOR_ADD",
  "CONNECTOR_EDIT",
  "CONNECTOR_DELETE"
];

export const DEFAULT_GENERATE_RULES = {
  chargePointsPerStation: 5,
  connectorsPerChargePoint: 2,
  connectorProfileByCpo: {
    "cpo-vgreen": { maxPower: 250, price: 3800, type: 0, voltage: 800 },
    "cpo-eboost": { maxPower: 22, price: 3200, type: 1, voltage: 400 },
    "cpo-datbike": { maxPower: 7.4, price: 2500, type: 1, voltage: 220 }
  }
};
