import mongoose from "mongoose";
import { registerModel } from "./register.js";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    active: { type: Boolean, default: true },
    role: { type: String, default: "admin" },
  },
  { timestamps: true },
);

export default registerModel("User", userSchema);
