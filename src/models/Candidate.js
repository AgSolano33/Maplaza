import mongoose from "mongoose";
import { registerModel } from "./register.js";

const candidateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  },
  { timestamps: true },
);

export default registerModel("Candidate", candidateSchema);
