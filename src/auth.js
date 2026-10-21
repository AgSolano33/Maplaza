import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { validateEmail } from "@/domain/validators";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 12 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Correo", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      authorize: async (credentials) => {
        const email = validateEmail(credentials?.email);
        const password = String(credentials?.password || "");
        if (!email || !password) return null;
        await connectDB();
        const user = await User.findOne({ email, active: true });
        if (!user) return null;
        const matches = await bcrypt.compare(password, user.passwordHash);
        if (!matches) return null;
        return { id: String(user._id), name: user.name, email: user.email };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.name = user.name;
        token.email = user.email;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub;
        session.user.name = token.name || session.user.name;
        session.user.email = token.email || session.user.email;
      }
      return session;
    },
  },
});
