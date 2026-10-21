import mongoose from "mongoose";

const globalCache = globalThis;

if (!globalCache.__maplasaMongoose) {
  globalCache.__maplasaMongoose = { conn: null, promise: null };
}

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI no está configurada.");
  }
  if (globalCache.__maplasaMongoose.conn) return globalCache.__maplasaMongoose.conn;
  if (!globalCache.__maplasaMongoose.promise) {
    globalCache.__maplasaMongoose.promise = mongoose.connect(uri, { bufferCommands: false });
  }
  globalCache.__maplasaMongoose.conn = await globalCache.__maplasaMongoose.promise;
  return globalCache.__maplasaMongoose.conn;
}

export async function disconnectDB() {
  await mongoose.disconnect();
  globalCache.__maplasaMongoose.conn = null;
  globalCache.__maplasaMongoose.promise = null;
}
