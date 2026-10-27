import { deleteModel, model, models, type Schema } from "mongoose";

// Contrat d'API : on expose `id`, jamais `_id` ni `__v`.
// Seulement sur toJSON : toObject garde `_id` pour le code serveur. Une requête
// `.lean()` renvoie le document brut, à ne jamais envoyer tel quel au client.
// `hide` retire en plus les champs propres à un modèle.
export function jsonOptions(hide?: (ret: Record<string, unknown>) => void) {
  return {
    virtuals: true,
    versionKey: false,
    transform(_doc: unknown, ret: Record<string, unknown>) {
      delete ret._id;
      delete ret.passwordHash;
      hide?.(ret);
      return ret;
    },
  };
}

const toJSON = jsonOptions();

export const baseOptions = { timestamps: true, toJSON } as const;
export const createdOnlyOptions = {
  timestamps: { createdAt: true, updatedAt: false },
  toJSON,
} as const;

// Refuse un document qui se référence lui-même (se suivre, s'acheter une
// compétence). Ne joue qu'au save()/create() : les upserts passent outre.
export function rejectSelfReference(schema: Schema, a: string, b: string, message: string) {
  schema.pre("validate", function (this: { get(path: string): unknown; invalidate(path: string, msg: string): void }) {
    const [x, y] = [this.get(a), this.get(b)];
    if (x != null && String(x) === String(y)) this.invalidate(b, message);
  });
}

// En dev, le hot reload réévalue le module : on recompile pour prendre en
// compte les changements de schéma. En prod, plusieurs bundles peuvent
// importer le même modèle : on réutilise celui déjà compilé.
// Le cast garde les types du schéma, que `models[name]` (Model<any>) effacerait.
export function defineModel<TSchema extends Schema>(name: string, schema: TSchema) {
  const compile = () => model(name, schema);
  if (process.env.NODE_ENV !== "production" && models[name]) deleteModel(name);
  return (models[name] as ReturnType<typeof compile> | undefined) ?? compile();
}

// Jour civil à Paris (YYYY-MM-DD) : séries, gains du jour.
// formatToParts ne dépend pas du format d'une locale (ICU réduit).
const parisFormat = new Intl.DateTimeFormat("en", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function parisDay(date = new Date()) {
  const parts = parisFormat.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
