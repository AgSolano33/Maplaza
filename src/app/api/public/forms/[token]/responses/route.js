import { api, assertPublicOrigin, clientIp, json, readJson } from "@/lib/http";
import { assertRateLimit } from "@/lib/rate-limit";
import { submitPublicResponse } from "@/services/submissions";

export const POST = api(async (request, context) => {
  const { token } = await context.params;
  assertPublicOrigin(request);
  assertRateLimit(`public-post:${clientIp(request)}:${token}`, 20, 60_000);
  const body = await readJson(request);
  const result = await submitPublicResponse({
    token,
    body,
    idempotencyKey: request.headers.get("idempotency-key"),
  });
  return json(result, result.replay ? 200 : 201);
});
