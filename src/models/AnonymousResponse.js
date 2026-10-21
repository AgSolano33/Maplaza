import mongoose from "mongoose";
import { registerModel } from "./register.js";
import { answerSchema } from "./schemas.js";

const anonymousResponseSchema = new mongoose.Schema(
  {
    formId: { type: mongoose.Schema.Types.ObjectId, ref: "Form", required: true },
    formVersionId: { type: mongoose.Schema.Types.ObjectId, ref: "FormVersion", required: true },
    distributionLinkId: { type: mongoose.Schema.Types.ObjectId, ref: "DistributionLink", required: true },
    areaId: { type: mongoose.Schema.Types.ObjectId, ref: "Area", default: null },
    areaName: { type: String, default: "" },
    answers: { type: [answerSchema], default: [] },
    idempotencyKey: { type: String, required: true, unique: true },
    submittedAt: { type: Date, default: Date.now },
  },
  {
    strict: "throw",
    timestamps: false,
  },
);

anonymousResponseSchema.index({ formVersionId: 1, submittedAt: -1 });
anonymousResponseSchema.index({ formVersionId: 1, areaId: 1, submittedAt: -1 });

export default registerModel("AnonymousResponse", anonymousResponseSchema);
