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
