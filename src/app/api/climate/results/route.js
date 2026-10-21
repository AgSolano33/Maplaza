import { api, json } from "@/lib/http";
import { requireAdmin } from "@/lib/auth-guard";
import { climateReport } from "@/controllers/climate";

export const GET = api(async (request) => {
  await requireAdmin(request);
  return json(await climateReport(new URL(request.url)));
});
