import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_GENERATE_RULES } from "../constants.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..", "..", "..");

const SAMPLE_DATA_PATH = path.join(ROOT, "Backend", "sampleData.txt");
const STATION_TYPE_PATH = path.join(ROOT, "Backend", "stationType.json");
const GENERATE_RULES_PATH = path.join(ROOT, "Backend", "generate.txt");

function normalizeStationTypeText(rawText) {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return { stations: [] };
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const wrapped = `{${trimmed.replace(/,\s*$/, "")}}`;
    return JSON.parse(wrapped);
  }
}

function parseSampleDataLine(line) {
  const tupleRegex =
    /^\('([^']+)',\s*'([^']+)',\s*'([^']+)',\s*(\d+),\s*'([^']+)',\s*'([^']+)',\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\),?$/;
  const match = line.match(tupleRegex);
  if (!match) {
    return null;
  }

  const [
    ,
    id,
    address,
    district,
    status,
    cpoId,
    name,
    latitude,
    longitude
  ] = match;

  return {
    id,
    address,
    district,
    status: Number(status),
    cpoId,
    name,
    latitude: Number(latitude),
    longitude: Number(longitude)
  };
}

function parseSampleData(rawText) {
  return rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("("))
    .map(parseSampleDataLine)
    .filter(Boolean);
}

function parseGenerateRules(rawText) {
  const rules = JSON.parse(JSON.stringify(DEFAULT_GENERATE_RULES));
  const chargePointMatch = rawText.match(/generate_series\(1,\s*(\d+)\)\s+AS g\(n\);/);
  if (chargePointMatch) {
    rules.chargePointsPerStation = Number(chargePointMatch[1]);
  }

  const connectorMatch = rawText.match(
    /LATERAL generate_series\(1,\s*(\d+)\)\s+AS g\(n\);/g
  );
  if (connectorMatch && connectorMatch.length > 0) {
    const lastMatch = connectorMatch[connectorMatch.length - 1].match(
      /generate_series\(1,\s*(\d+)\)/
    );
    if (lastMatch) {
      rules.connectorsPerChargePoint = Number(lastMatch[1]);
    }
  }

  return rules;
}

export async function loadSeedData() {
  const [sampleDataRaw, stationTypeRaw, generateRaw] = await Promise.all([
    fs.readFile(SAMPLE_DATA_PATH, "utf8"),
    fs.readFile(STATION_TYPE_PATH, "utf8"),
    fs.readFile(GENERATE_RULES_PATH, "utf8")
  ]);

  const sampleData = parseSampleData(sampleDataRaw);
  const stationType = normalizeStationTypeText(stationTypeRaw);
  const generateRules = parseGenerateRules(generateRaw);

  return {
    sampleData,
    stationType,
    generateRules
  };
}
