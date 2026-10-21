import mongoose from "mongoose";
import { registerModel } from "./register.js";

const employmentFollowUpSchema = new mongoose.Schema(
  {
    candidateId: { type: mongoose.Schema.Types.ObjectId, ref: "Candidate", required: true },
    applicationId: { type: mongoose.Schema.Types.ObjectId, ref: "Application", required: true, unique: true },
    startDate: { type: Date, required: true },
    situation: { type: String, enum: ["active", "exited"], required: true },
    exitDate: { type: Date, default: null },
    exitReason: { type: String, default: "" },
    notes: { type: String, default: "" },
  },
  { timestamps: true },
);

employmentFollowUpSchema.index({ situation: 1, startDate: -1 });

export default registerModel("EmploymentFollowUp", employmentFollowUpSchema);
