import { api } from "@/lib/http";
import { requireAdmin } from "@/lib/auth-guard";
import { exportClimate } from "@/controllers/climate";

export const GET = api(async (request) => {
  await requireAdmin(request);
  const csv = await exportClimate(new URL(request.url));
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=\"maplasa-clima.csv\"",
    },
  });
});
