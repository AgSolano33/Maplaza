import { api, json } from "@/lib/http";
import { requireAdmin } from "@/lib/auth-guard";
import { listApplications } from "@/controllers/applications";

export const GET = api(async (request) => {
  await requireAdmin(request);
  return json(await listApplications(new URL(request.url)));
});
