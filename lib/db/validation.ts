import { Prisma } from "@prisma/client";
import { InvalidInputError } from "./errors";

// Prisma ne valide que les types : les longueurs, minimums et normalisations
// sont appliqués ici, à
// chaque create, createMany, update, updateMany et upsert, transactions
// comprises. Les écritures imbriquées (`posts: { create: … }`) et les
// opérations atomiques (`increment`) n'y passent pas.

type Rule = { trim?: boolean; lowercase?: boolean; required?: boolean; maxLength?: number; min?: number };

type ModelRules = {
  fields?: Record<string, Rule>;
  /** Deux champs qui ne peuvent pas désigner le même utilisateur, et le message d'erreur. */
  distinct?: [string, string, string];
};

const RULES: Partial<Record<Prisma.ModelName, ModelRules>> = {
  User: {
    fields: {
      email: { trim: true, lowercase: true, required: true },
      username: { trim: true, lowercase: true, required: true, maxLength: 30 },
      displayName: { trim: true, maxLength: 50 },
      bio: { maxLength: 150 },
      points: { min: 0 },
      totalEarned: { min: 0 },
    },
  },
  Post: { fields: { caption: { maxLength: 2200 }, location: { maxLength: 80 } } },
  Comment: { fields: { text: { trim: true, required: true, maxLength: 500 } } },
  Message: { fields: { text: { trim: true, required: true, maxLength: 2000 } } },
  Conversation: { fields: { lastMessagePreview: { maxLength: 100 } } },
  ShopItem: { fields: { price: { min: 0 } } },
  Order: { fields: { quantity: { min: 1 } } },
  Draw: { fields: { cost: { min: 0 } } },
  Follow: { distinct: ["followerId", "followingId", "On ne se suit pas soi-même"] },
  Block: { distinct: ["blockerId", "blockedId", "On ne se bloque pas soi-même"] },
  CloseFriend: { distinct: ["ownerId", "friendId", "On n'est pas son propre ami proche"] },
  SkillPurchase: { distinct: ["buyerId", "targetId", "On n'espionne pas son propre compte"] },
};

type Data = Record<string, unknown>;

function check(model: string, rules: ModelRules, data: Data) {
  const out: Data = { ...data };
  for (const [field, rule] of Object.entries(rules.fields ?? {})) {
    if (!(field in out)) continue;
    // En update, une valeur peut arriver sous la forme `{ set: v }`.
    const wrapped = out[field] !== null && typeof out[field] === "object" && "set" in (out[field] as object);
    let value = wrapped ? (out[field] as { set: unknown }).set : out[field];
    if (typeof value === "string") {
      let text = value;
      if (rule.trim) text = text.trim();
      if (rule.lowercase) text = text.toLowerCase();
      if (rule.required && !text) throw new InvalidInputError(`${model}.${field} est obligatoire`);
      if (rule.maxLength !== undefined && text.length > rule.maxLength) {
        throw new InvalidInputError(`${model}.${field} : ${rule.maxLength} caractères max`);
      }
      value = text;
    }
    if (typeof value === "number" && rule.min !== undefined && value < rule.min) {
      throw new InvalidInputError(`${model}.${field} : minimum ${rule.min}`);
    }
    out[field] = wrapped ? { set: value } : value;
  }
  if (rules.distinct) {
    const [a, b, message] = rules.distinct;
    if (out[a] != null && String(out[a]) === String(out[b])) throw new InvalidInputError(message);
  }
  return out;
}

export const validation = Prisma.defineExtension({
  name: "validation",
  query: {
    $allModels: {
      $allOperations({ model, operation, args, query }) {
        const rules = RULES[model as Prisma.ModelName];
        if (!rules) return query(args);
        const a = args as { data?: Data | Data[]; create?: Data; update?: Data };
        const run = (data: Data) => check(model, rules, data);
        switch (operation) {
          case "create":
            a.data = run(a.data as Data);
            break;
          case "createMany":
            a.data = Array.isArray(a.data) ? a.data.map((d) => run(d)) : run(a.data as Data);
            break;
          case "update":
          case "updateMany":
            a.data = run(a.data as Data);
            break;
          case "upsert":
            a.create = run(a.create as Data);
            a.update = run(a.update as Data);
            break;
        }
        return query(args);
      },
    },
  },
});
