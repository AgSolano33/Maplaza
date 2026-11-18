import { api, json, readJson } from "@/lib/http";
import { requireAdmin } from "@/lib/auth-guard";
import { publishForm } from "@/controllers/forms";

export const POST = api(async (request, context) => {
  const user = await requireAdmin(request);
  const { id } = await context.params;
  const length = Number(request.headers.get("content-length") || 0);
  const input = length > 0 ? await readJson(request) : undefined;
  return json(await publishForm(user, id, input));
});
