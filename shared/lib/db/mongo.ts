import mongoose from "mongoose";

type MongoCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  var fr3shuPosMongo: MongoCache | undefined;
}

const cache = globalThis.fr3shuPosMongo ?? { conn: null, promise: null };
globalThis.fr3shuPosMongo = cache;

const getMongoUri = (): string => {
  const uri = process.env.MONGODB_URI?.trim().replace(/^["']|["']$/g, "");
  if (!uri || uri.includes("<user>") || uri.includes("<password>") || uri.includes("<cluster>")) {
    throw new Error("MONGODB_URI is missing or still contains placeholder credentials.");
  }
  return uri;
};

mongoose.set("bufferCommands", false);

/**
 * Cached MongoDB connection singleton.
 * RULE: every API route calls `await mongoDB()` before any DB operation.
 */
export const mongoDB = async (): Promise<typeof mongoose> => {
  if (cache.conn && mongoose.connection.readyState === 1) return cache.conn;

  if (!cache.promise) {
    cache.promise = mongoose
      .connect(getMongoUri(), {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 30000,
        bufferCommands: false,
      })
      .then((m) => {
        cache.conn = m;
        return m;
      })
      .catch((err: unknown) => {
        cache.promise = null;
        cache.conn = null;
        throw err;
      });
  }

  return cache.promise;
};
