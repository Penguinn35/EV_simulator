const CPO_NAME_BY_ID = {
  "cpo-vgreen": "VGreen",
  "cpo-eboost": "EBoost",
  "cpo-datbike": "Dat Bike"
};

function fallbackNameFromId(cpoId) {
  return cpoId
    .replace(/^cpo-/, "")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function buildInitialCpoConfigs(seedData) {
  const cpoIds = [...new Set(seedData.sampleData.map((item) => item.cpoId))];
  return cpoIds.map((cpoId) => ({
    id: cpoId,
    name: CPO_NAME_BY_ID[cpoId] ?? fallbackNameFromId(cpoId),
    baseUrl: "",
    username: "",
    password: ""
  }));
}
