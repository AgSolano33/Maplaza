import mongoose from "mongoose";
import { registerModel } from "./register.js";

const setupLockSchema = new mongoose.Schema({
  _id: { type: String },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
});

export default registerModel("SetupLock", setupLockSchema);
