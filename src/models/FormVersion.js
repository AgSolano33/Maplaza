import mongoose from "mongoose";
import { registerModel } from "./register.js";
import { appearanceSchema, questionSchema } from "./schemas.js";

const formVersionSchema = new mongoose.Schema(
  {
    formId: { type: mongoose.Schema.Types.ObjectId, ref: "Form", required: true },
    versionNumber: { type: Number, required: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    modality: { type: String, enum: ["recruitment", "climate"], required: true },
    targetRole: { type: String, default: "" },
    instructions: { type: String, default: "" },
    confirmationMessage: { type: String, default: "" },
    opensAt: { type: Date, default: null },
    closesAt: { type: Date, default: null },
    questions: { type: [questionSchema], default: [] },
    appearance: { type: appearanceSchema, default: () => ({}) },
    publishedAt: { type: Date, default: Date.now },
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

formVersionSchema.index({ formId: 1, versionNumber: 1 }, { unique: true });

function rejectMutation() {
  throw new Error("Las versiones publicadas son inmutables.");
}

formVersionSchema.pre("save", function rejectSavedEdits() {
  if (!this.isNew) rejectMutation();
});
formVersionSchema.pre("updateOne", rejectMutation);
formVersionSchema.pre("updateMany", rejectMutation);
formVersionSchema.pre("findOneAndUpdate", rejectMutation);
formVersionSchema.pre("replaceOne", rejectMutation);
formVersionSchema.pre("findOneAndReplace", rejectMutation);

export default registerModel("FormVersion", formVersionSchema);
