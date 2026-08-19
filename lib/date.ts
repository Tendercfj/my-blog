import type { IsoDate } from "@/lib/content/types";

const formatter = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "UTC",
});

export function formatDate(value: IsoDate): string {
  return formatter.format(new Date(`${value}T00:00:00Z`));
}

export function formatShortDate(value: IsoDate): string {
  return value.slice(5).replace("-", ".");
}
