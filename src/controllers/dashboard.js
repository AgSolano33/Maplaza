import { connectDB } from "@/lib/db";
import { formatScore } from "@/domain/scoring";
import Application from "@/models/Application";
import Form from "@/models/Form";
import Candidate from "@/models/Candidate";
import Competency from "@/models/Competency";

export async function dashboardData() {
  await connectDB();
  const [applicationCount, candidateIds, publishedForms, pending, recent, scoreAgg, competencyAgg, catalog] =
    await Promise.all([
      Application.countDocuments(),
      Application.distinct("candidateId"),
      Form.countDocuments({ status: "published" }),
      Application.countDocuments({ reviewStatus: "pending" }),
      Application.find().sort({ submittedAt: -1 }).limit(5),
      Application.aggregate([
        { $match: { "scoring.globalScore": { $type: "number" } } },
        { $group: { _id: null, avg: { $avg: "$scoring.globalScore" } } },
      ]),
      Application.aggregate([
        { $unwind: "$scoring.competencies" },
        {
          $group: {
            _id: "$scoring.competencies.name",
            avg: { $avg: "$scoring.competencies.scorePercent" },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Competency.find().sort({ name: 1 }),
    ]);

  const candidates = await Candidate.find({ _id: { $in: recent.map((item) => item.candidateId) } });
  const forms = await Form.find({ _id: { $in: recent.map((item) => item.formId) } }).select("title");
  const candidateById = new Map(candidates.map((item) => [String(item._id), item]));
  const formById = new Map(forms.map((item) => [String(item._id), item]));
  const observed = new Map(competencyAgg.map((item) => [item._id, item]));

  return {
    candidatesEvaluated: candidateIds.length,
    applications: applicationCount,
    publishedForms,
    averageScore: scoreAgg[0]?.avg ?? null,
    averageScoreLabel: formatScore(scoreAgg[0]?.avg ?? null),
    pendingReview: pending,
    recent: recent.map((item) => {
      const candidate = candidateById.get(String(item.candidateId));
      return {
        applicationId: String(item._id),
        candidateId: candidate ? String(candidate._id) : "",
        name: candidate?.name || "Candidato",
        email: candidate?.email || "",
        formTitle: formById.get(String(item.formId))?.title || "Evaluación",
        globalScore: item.scoring?.globalScore ?? null,
        globalScoreLabel: formatScore(item.scoring?.globalScore),
        reviewStatus: item.reviewStatus,
        submittedAt: item.submittedAt,
      };
    }),
    competencies: catalog.map((item) => {
      const stats = observed.get(item.name);
      return {
        name: item.name,
        active: item.active,
        average: stats?.avg ?? null,
        averageLabel: stats ? formatScore(stats.avg) : "Sin datos",
        count: stats?.count || 0,
      };
    }),
  };
}
