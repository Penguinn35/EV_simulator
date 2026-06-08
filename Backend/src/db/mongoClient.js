import { MongoClient } from "mongodb";

let clientPromise = null;
let hasLoggedConnection = false;

function getMongoUri() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error("MONGODB_URI is required for MongoDB store");
  }
  return uri;
}

export function getMongoDbName() {
  return process.env.MONGODB_DB?.trim() || "ev_simulator";
}

export async function getMongoClient() {
  if (!clientPromise) {
    const uri = getMongoUri();
    const client = new MongoClient(uri);
    clientPromise = client.connect().then((connectedClient) => {
      if (!hasLoggedConnection) {
        const sanitizedUri = uri.replace(/\/\/([^:@]+):([^@]+)@/, "//$1:***@");
        // eslint-disable-next-line no-console
        console.log(`[BE][DB] MongoDB connected: ${sanitizedUri}`);
        hasLoggedConnection = true;
      }
      return connectedClient;
    });
  }
  return clientPromise;
}

export async function getMongoDb() {
  const client = await getMongoClient();
  const dbName = getMongoDbName();
  if (hasLoggedConnection) {
    // eslint-disable-next-line no-console
    console.log(`[BE][DB] Using database: ${dbName}`);
  }
  return client.db(dbName);
}
