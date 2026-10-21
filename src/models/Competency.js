import mongoose from "mongoose";
import { registerModel } from "./register.js";

const competencySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

competencySchema.index({ name: 1 }, { unique: true });

export default registerModel("Competency", competencySchema);
