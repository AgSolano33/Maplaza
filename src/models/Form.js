import mongoose from "mongoose";
import { registerModel } from "./register.js";
import { appearanceSchema, questionSchema } from "./schemas.js";

const formSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    modality: { type: String, enum: ["recruitment", "climate"], required: true },
    targetRole: { type: String, default: "" },
    instructions: { type: String, default: "" },
    confirmationMessage: { type: String, default: "" },
    opensAt: { type: Date, default: null },
    closesAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ["draft", "published", "closed", "archived"],
      default: "draft",
      index: true,
    },
    questions: { type: [questionSchema], default: [] },
    appearance: { type: appearanceSchema, default: () => ({}) },
    publishedVersion: { type: Number, default: 0 },
    hasUnpublishedChanges: { type: Boolean, default: true },
    receptionOpen: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

formSchema.index({ status: 1, modality: 1, updatedAt: -1 });

export default registerModel("Form", formSchema);
