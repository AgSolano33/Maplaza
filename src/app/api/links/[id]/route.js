import { api, json, readJson } from "@/lib/http";
import { requireAdmin } from "@/lib/auth-guard";
import { setLinkReception } from "@/controllers/links";

export const PATCH = api(async (request, context) => {
  await requireAdmin(request);
  const { id } = await context.params;
  const body = await readJson(request);
  return json(await setLinkReception(id, body.acceptingResponses));
});
