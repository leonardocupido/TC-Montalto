import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";

export function formatMatchDate(date: string): string {
  const s = format(parseISO(date), "EEEE d MMMM", { locale: it });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function telHref(phone: string): string {
  return `tel:${phone.replace(/\s+/g, "")}`;
}
