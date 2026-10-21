import { connectDB } from "@/lib/db";
import { ApiError, isDuplicateKey } from "@/lib/errors";
import { normalizeCatalogName } from "@/domain/validators";
import Area from "@/models/Area";
import Competency from "@/models/Competency";

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function assertUnique(Model, name, id) {
  const existing = await Model.findOne({
    name: new RegExp(`^${escapeRegex(name)}$`, "i"),
    ...(id ? { _id: { $ne: id } } : {}),
  });
  if (existing) throw new ApiError(409, "DUPLICATE", "Ya existe un elemento con ese nombre.");
}

function serialize(item) {
  return {
    id: String(item._id),
    name: item.name,
    active: item.active,
    createdAt: item.createdAt,
  };
}

function controllerFor(Model) {
  return {
    async list() {
      await connectDB();
      const items = await Model.find().sort({ active: -1, name: 1 });
      return { items: items.map(serialize) };
    },
    async create(input) {
      await connectDB();
      const name = normalizeCatalogName(input?.name);
      if (name.length < 2) throw new ApiError(422, "VALIDATION", "Escribe un nombre.", { name: "El nombre es demasiado corto." });
      await assertUnique(Model, name);
      try {
        const item = await Model.create({ name, active: true });
        return serialize(item);
      } catch (error) {
        if (isDuplicateKey(error, "name")) throw new ApiError(409, "DUPLICATE", "Ya existe un elemento con ese nombre.");
        throw error;
      }
    },
    async update(id, input) {
      await connectDB();
      const item = await Model.findById(id);
      if (!item) throw new ApiError(404, "NOT_FOUND", "No se encontró el elemento.");
      if (input?.name != null) {
        const name = normalizeCatalogName(input.name);
        if (name.length < 2) throw new ApiError(422, "VALIDATION", "Escribe un nombre.", { name: "El nombre es demasiado corto." });
        await assertUnique(Model, name, item._id);
        item.name = name;
      }
      if (input?.active != null) item.active = Boolean(input.active);
      try {
        await item.save();
      } catch (error) {
        if (isDuplicateKey(error, "name")) throw new ApiError(409, "DUPLICATE", "Ya existe un elemento con ese nombre.");
        throw error;
      }
      return serialize(item);
    },
  };
}

export const areas = controllerFor(Area);
export const competencies = controllerFor(Competency);
