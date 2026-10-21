import mongoose from "mongoose";
import { registerModel } from "./register.js";

const areaSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

areaSchema.index({ name: 1 }, { unique: true });

export default registerModel("Area", areaSchema);
