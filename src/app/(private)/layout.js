import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { connectDB } from "@/lib/db";
import User from "@/models/User";

export const dynamic = "force-dynamic";

export default async function PrivateLayout({ children }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");
  await connectDB();
  const user = await User.findById(userId).select("name email active");
  if (!user?.active) redirect("/salir");
  return <AppShell user={{ id: userId, name: user.name, email: user.email }}>{children}</AppShell>;
}
