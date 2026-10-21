import { api, json } from "@/lib/http";
import { requireAdmin } from "@/lib/auth-guard";
import { dashboardData } from "@/controllers/dashboard";

export const GET = api(async (request) => {
  await requireAdmin(request);
  return json(await dashboardData());
});
