import { api, json, readJson } from "@/lib/http";
import { requireAdmin } from "@/lib/auth-guard";
import { updateFollowUp } from "@/controllers/followups";

export const PATCH = api(async (request, context) => {
  await requireAdmin(request);
  const { id } = await context.params;
  return json(await updateFollowUp(id, await readJson(request)));
});
