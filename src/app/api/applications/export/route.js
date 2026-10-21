import { api } from "@/lib/http";
import { requireAdmin } from "@/lib/auth-guard";
import { exportApplications } from "@/controllers/applications";

export const GET = api(async (request) => {
  await requireAdmin(request);
  const csv = await exportApplications(new URL(request.url));
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=\"maplasa-candidatos.csv\"",
    },
  });
});
