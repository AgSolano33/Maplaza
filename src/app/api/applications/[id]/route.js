import { api, json, readJson } from "@/lib/http";
import { requireAdmin } from "@/lib/auth-guard";
import { updateApplication } from "@/controllers/applications";

export const PATCH = api(async (request, context) => {
  await requireAdmin(request);
  const { id } = await context.params;
  return json(await updateApplication(id, await readJson(request)));
});
