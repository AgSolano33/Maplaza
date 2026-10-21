import mongoose from "mongoose";
import { QUESTION_TYPES } from "../domain/constants.js";

const optionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    label: { type: String, default: "" },
    score: { type: Number, min: 0, max: 5 },
  },
  { _id: false },
);

export const questionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    type: {
      type: String,
      enum: QUESTION_TYPES,
      required: true,
    },
    prompt: { type: String, default: "" },
    required: { type: Boolean, default: false },
    competencyId: { type: mongoose.Schema.Types.ObjectId, default: null },
    competencyName: { type: String, default: "" },
    scored: { type: Boolean, default: false },
    options: { type: [optionSchema], default: [] },
    scaleLabels: { type: [String], default: [] },
  },
  { _id: false },
);

export const appearanceSchema = new mongoose.Schema(
  {
    primaryColor: { type: String, default: "#315ce8" },
    logo: { type: String, default: "" },
    cover: { type: String, default: "" },
  },
  { _id: false },
);

export const answerSchema = new mongoose.Schema(
  {
    questionId: { type: String, required: true },
    optionId: { type: String },
    optionIds: { type: [String], default: undefined },
    scaleValue: { type: Number, min: 1, max: 5 },
    text: { type: String, maxlength: 4000 },
  },
  { _id: false },
);

export function idOf(document) {
  if (!document) return null;
  return String(document._id || document.id);
}

export function plain(document) {
  if (!document) return null;
  const value = typeof document.toObject === "function" ? document.toObject({ versionKey: false }) : { ...document };
  value.id = String(value._id);
  delete value._id;
  delete value.passwordHash;
  return value;
}
