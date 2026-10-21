import mongoose from "mongoose";

export function registerModel(name, schema) {
  const cached = mongoose.models[name];
  if (cached && process.env.NODE_ENV === "production") return cached;
  if (cached) mongoose.deleteModel(name);
  return mongoose.model(name, schema);
}
