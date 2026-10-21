import { connectDB, disconnectDB } from "../src/lib/db.js";
import { newId, newToken } from "../src/domain/ids.js";
import User from "../src/models/User.js";
import Area from "../src/models/Area.js";
import Competency from "../src/models/Competency.js";
import Form from "../src/models/Form.js";
import FormVersion from "../src/models/FormVersion.js";
import DistributionLink from "../src/models/DistributionLink.js";

const competencies = [
  "Trabajo en equipo",
  "Responsabilidad",
  "Adaptabilidad",
  "Comunicación",
  "Resolución de conflictos",
  "Aprendizaje",
];

const areas = ["Producción", "Administración", "Almacén", "Calidad", "Mantenimiento"];

const recruitmentQuestions = [
  ["Un compañero nuevo no comprende una instrucción. ¿Qué haces?", "Trabajo en equipo", ["Le explico el procedimiento y verifico que lo comprenda", "Aviso al supervisor para que le brinde apoyo", "Sigo con mi trabajo sin intervenir", "Hago la tarea por él sin explicarle"], [5, 4, 2, 2]],
  ["Detectas un error en un producto antes de entregarlo. ¿Cómo actúas?", "Responsabilidad", ["Detengo el proceso y reporto el error siguiendo el procedimiento", "Pregunto al supervisor qué hacer antes de continuar", "Lo dejo pasar si parece pequeño", "Espero a que otra persona lo descubra"], [5, 4, 1, 0]],
  ["La empresa introduce una nueva forma de registrar la producción. ¿Qué haces?", "Adaptabilidad", ["Aprendo el procedimiento y comunico dudas concretas", "Solicito capacitación para aplicarlo correctamente", "Uso el proceso anterior sin comentarlo", "Evito utilizar el nuevo registro"], [5, 5, 1, 0]],
];

if (!process.env.MONGODB_URI) {
  console.error("Define MONGODB_URI antes de ejecutar yarn seed.");
  process.exit(1);
}

await connectDB();
const admin = await User.findOne({ active: true });
if (!admin) {
  console.error("Crea el administrador en /setup antes de cargar datos de desarrollo.");
  await disconnectDB();
  process.exit(1);
}

const competencyDocs = [];
for (const name of competencies) {
  competencyDocs.push(await Competency.findOneAndUpdate({ name }, { name, active: true }, { upsert: true, new: true }));
}
for (const name of areas) {
  await Area.findOneAndUpdate({ name }, { name, active: true }, { upsert: true, new: true });
}

const existing = await Form.findOne({ title: "Competencias operativas" });
if (!existing) {
  const byName = new Map(competencyDocs.map((item) => [item.name, item]));
  const questions = recruitmentQuestions.map(([prompt, competency, labels, scores]) => ({
    id: newId(),
    type: "single",
    prompt,
    required: true,
    competencyId: byName.get(competency)._id,
    competencyName: competency,
    options: labels.map((label, index) => ({ id: newId(), label, score: scores[index] })),
    scaleLabels: [],
  }));
  const form = await Form.create({
    title: "Competencias operativas",
    description: "Situaciones laborales para orientar una entrevista. Los datos de ejemplo no incluyen candidatos.",
    modality: "recruitment",
    targetRole: "Operador de producción",
    instructions: "Elige la opción más cercana a lo que harías.",
    confirmationMessage: "Recibimos tu evaluación. El equipo de RH la revisará.",
    status: "published",
    questions,
    publishedVersion: 1,
    hasUnpublishedChanges: false,
    receptionOpen: true,
    createdBy: admin._id,
  });
  const version = await FormVersion.create({
    formId: form._id,
    versionNumber: 1,
    title: form.title,
    description: form.description,
    modality: form.modality,
    targetRole: form.targetRole,
    instructions: form.instructions,
    confirmationMessage: form.confirmationMessage,
    questions,
    publishedBy: admin._id,
  });
  await DistributionLink.create({
    token: newToken(),
    formId: form._id,
    formVersionId: version._id,
    acceptingResponses: true,
    createdBy: admin._id,
  });
  console.log("Formulario de ejemplo publicado. El enlace aparece en la ficha del formulario.");
} else {
  console.log("El formulario de ejemplo ya existía.");
}

await disconnectDB();
