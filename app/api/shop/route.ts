import { SHOP_ITEMS } from "@/lib/server/seed";

export function GET() {
  return Response.json({ items: SHOP_ITEMS });
}
