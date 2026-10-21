import mongoose from "mongoose";
import { registerModel } from "./register.js";

const distributionLinkSchema = new mongoose.Schema(
  {
    token: { type: String, required: true, unique: true },
    formId: { type: mongoose.Schema.Types.ObjectId, ref: "Form", required: true },
    formVersionId: { type: mongoose.Schema.Types.ObjectId, ref: "FormVersion", required: true },
    areaId: { type: mongoose.Schema.Types.ObjectId, ref: "Area", default: null },
    areaName: { type: String, default: "" },
    acceptingResponses: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

distributionLinkSchema.index({ formId: 1, createdAt: -1 });
distributionLinkSchema.index({ formVersionId: 1 });

export default registerModel("DistributionLink", distributionLinkSchema);
