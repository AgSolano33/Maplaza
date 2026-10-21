import { getToken } from "next-auth/jwt";
import { auth } from "@/auth";
import { connectDB } from "./db.js";
import { ApiError } from "./errors.js";
import { assertSameOrigin } from "./http.js";
import User from "@/models/User";

async function sessionUserId(request) {
  const secureCookie = (request.headers.get("x-forwarded-proto") || "").split(",")[0].trim() === "https";
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    secureCookie,
  });
  if (token?.sub) return token.sub;
  const session = await auth();
  return session?.user?.id || null;
}

export async function requireAdmin(request) {
  assertSameOrigin(request);
  const userId = await sessionUserId(request);
  if (!userId) {
    throw new ApiError(401, "UNAUTHENTICATED", "Debes iniciar sesión.");
  }
  await connectDB();
  const user = await User.findById(userId).select("name email active");
  if (!user?.active) {
    throw new ApiError(401, "UNAUTHENTICATED", "La sesión ya no es válida.");
  }
  return user;
}
