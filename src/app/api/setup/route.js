import { api, assertSameOrigin, clientIp, json, readJson } from "@/lib/http";
import { assertRateLimit } from "@/lib/rate-limit";
import { createFirstAdmin, getSetupState } from "@/controllers/setup";

export const GET = api(async () => json(await getSetupState()));

export const POST = api(async (request) => {
  assertSameOrigin(request);
  assertRateLimit(`setup:${clientIp(request)}`, 5, 60 * 60 * 1000);
  return json(await createFirstAdmin(await readJson(request)), 201);
});
