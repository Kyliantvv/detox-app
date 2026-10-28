import { loginDemo } from "@/lib/server/accounts";
import { json, route } from "@/lib/server/http";

export const POST = route(async () => json(await loginDemo()));
