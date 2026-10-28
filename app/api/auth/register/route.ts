import { registerAccount } from "@/lib/server/accounts";
import { json, readBody, route } from "@/lib/server/http";

export const POST = route(async (request) => {
  const body = await readBody(request, { email: "string", username: "string", password: "string" });
  return json(registerAccount(body), 201);
});
