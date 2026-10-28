import { loginWithPassword } from "@/lib/server/accounts";
import { json, readBody, route } from "@/lib/server/http";

export const POST = route(async (request) => {
  const { email, password } = await readBody(request, { email: "string", password: "string" });
  return json(await loginWithPassword(email, password));
});
