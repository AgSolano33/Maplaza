import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { ApiError, isDuplicateKey } from "@/lib/errors";
import User from "@/models/User";
import SetupLock from "@/models/SetupLock";
import { validateEmail, validatePassword } from "@/domain/validators";

export async function getSetupState() {
  await connectDB();
  const count = await User.countDocuments();
  return { needsSetup: count === 0 };
}

export async function createFirstAdmin(input) {
  await connectDB();
  if ((await User.countDocuments()) > 0) {
    throw new ApiError(403, "SETUP_CLOSED", "El administrador inicial ya fue creado.");
  }

  const name = String(input?.name || "").replace(/\s+/g, " ").trim();
  const email = validateEmail(input?.email);
  const passwordError = validatePassword(input?.password);
  const errors = {};
  if (name.length < 2 || name.length > 120) errors.name = "Escribe el nombre de la persona administradora.";
  if (!email) errors.email = "Escribe un correo válido.";
  if (passwordError) errors.password = passwordError;
  if (Object.keys(errors).length) {
    throw new ApiError(422, "VALIDATION", "Revisa los datos del administrador.", errors);
  }

  try {
    await SetupLock.create({ _id: "bootstrap" });
  } catch (error) {
    if (isDuplicateKey(error)) {
      throw new ApiError(403, "SETUP_CLOSED", "El administrador inicial ya fue creado.");
    }
    throw error;
  }

  try {
    const passwordHash = await bcrypt.hash(String(input.password), 12);
    const user = await User.create({
      name,
      email,
      passwordHash,
      role: "admin",
      active: true,
    });
    await SetupLock.updateOne({ _id: "bootstrap" }, { userId: user._id });
    return { id: String(user._id), name: user.name, email: user.email };
  } catch (error) {
    await SetupLock.deleteOne({ _id: "bootstrap" });
    if (isDuplicateKey(error, "email")) {
      throw new ApiError(409, "DUPLICATE", "Ese correo ya está registrado.");
    }
    throw error;
  }
}
