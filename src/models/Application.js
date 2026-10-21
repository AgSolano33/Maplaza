import mongoose from "mongoose";
import { registerModel } from "./register.js";
import { answerSchema } from "./schemas.js";

const competencyScoreSchema = new mongoose.Schema(
  {
    competencyId: { type: mongoose.Schema.Types.ObjectId, default: null },
    name: { type: String, required: true },
    averageRaw: { type: Number, required: true },
    scorePercent: { type: Number, required: true },
    questionCount: { type: Number, required: true },
  },
  { _id: false },
);

const applicationSchema = new mongoose.Schema(
  {
    candidateId: { type: mongoose.Schema.Types.ObjectId, ref: "Candidate", required: true },
    formId: { type: mongoose.Schema.Types.ObjectId, ref: "Form", required: true },
    formVersionId: { type: mongoose.Schema.Types.ObjectId, ref: "FormVersion", required: true },
    distributionLinkId: { type: mongoose.Schema.Types.ObjectId, ref: "DistributionLink", required: true },
    answers: { type: [answerSchema], default: [] },
    scoring: {
      competencies: { type: [competencyScoreSchema], default: [] },
      globalScore: { type: Number, default: null },
    },
    reviewStatus: {
      type: String,
      enum: ["pending", "interview", "hired", "rejected"],
      default: "pending",
    },
    internalNotes: { type: String, default: "" },
    idempotencyKey: { type: String, required: true, unique: true },
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

applicationSchema.index({ candidateId: 1, submittedAt: -1 });
applicationSchema.index({ formId: 1, submittedAt: -1 });
applicationSchema.index({ reviewStatus: 1, submittedAt: -1 });

export default registerModel("Application", applicationSchema);
