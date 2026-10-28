// Libellés de temps relatifs affichés par l'API (« il y a 3 min »).
export function formatAgo(at: Date | number, now = Date.now()): string {
  const minutes = Math.floor((now - new Date(at).getTime()) / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "hier" : `il y a ${days} j`;
}

// Heure (0-23) à Paris, pour la compétence « Heures de pointe ».
const parisHour = new Intl.DateTimeFormat("en", { timeZone: "Europe/Paris", hour: "numeric", hourCycle: "h23" });
export const hourInParis = (date: Date) => Number(parisHour.format(date));
