import { api, clientIp, json } from "@/lib/http";
import { assertRateLimit } from "@/lib/rate-limit";
import { getPublicForm } from "@/services/submissions";

export const GET = api(async (request, context) => {
  const { token } = await context.params;
  assertRateLimit(`public-get:${clientIp(request)}:${token}`, 60, 60_000);
  return json(await getPublicForm(token));
});
