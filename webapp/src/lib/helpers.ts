import type { YardEvent, ServiceProvider, EmbeddedUser } from "./types";

// Curated fallback imagery (Unsplash) used when records have no usable photo.
const EVENT_FALLBACKS = [
  "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&h=600&fit=crop",
];

const PROVIDER_FALLBACKS = [
  "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1554519515-242161756769?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=800&h=600&fit=crop",
];

// Local mobile cache paths (file://...) can never load in a browser — treat as missing.
export function isUsableUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  return url.startsWith("http://") || url.startsWith("https://");
}

function pickFallback(list: string[], seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return list[h % list.length];
}

export function eventImage(event: Pick<YardEvent, "id" | "photos">): string {
  const usable = (event.photos ?? []).find(isUsableUrl);
  return usable ?? pickFallback(EVENT_FALLBACKS, event.id);
}

export function eventGallery(event: Pick<YardEvent, "id" | "photos">): string[] {
  const usable = (event.photos ?? []).filter(isUsableUrl);
  return usable.length > 0 ? usable : [pickFallback(EVENT_FALLBACKS, event.id)];
}

export function providerImage(
  provider: Pick<ServiceProvider, "id" | "photos">,
): string {
  const usable = (provider.photos ?? []).find(isUsableUrl);
  return usable ?? pickFallback(PROVIDER_FALLBACKS, provider.id);
}

export function providerGallery(
  provider: Pick<ServiceProvider, "id" | "photos">,
): string[] {
  const usable = (provider.photos ?? []).filter(isUsableUrl);
  return usable.length > 0 ? usable : [pickFallback(PROVIDER_FALLBACKS, provider.id)];
}

export function avatarUrl(url: string | null | undefined): string | undefined {
  return isUsableUrl(url) ? url : undefined;
}

export function initials(name: string | null | undefined): string {
  if (!name) return "YL";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "YL";
}

export function providerName(p: { user_data: EmbeddedUser | null; id: string }): string {
  return p.user_data?.name?.trim() || "YardLine Provider";
}

export function hostName(e: YardEvent): string {
  return e.host_data?.name?.trim() || "YardLine Host";
}

// Display helpers ---------------------------------------------------------

export function formatPrice(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

export function formatDollars(amount: number | null | undefined): string {
  if (amount == null) return "—";
  return `$${Number(amount).toFixed(Number(amount) % 1 === 0 ? 0 : 2)}`;
}

export function formatEventDate(date: string | null, opts?: { withYear?: boolean }): string {
  if (!date) return "Date TBA";
  const d = new Date(date.length <= 10 ? `${date}T00:00:00` : date);
  if (isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(opts?.withYear ? { year: "numeric" } : {}),
  });
}

export function formatEventTime(time: string | null): string | null {
  if (!time) return null;
  // Accept "HH:MM" or "HH:MM:SS" or full ISO.
  const match = time.match(/(\d{1,2}):(\d{2})/);
  if (!match) return time;
  let h = parseInt(match[1], 10);
  const m = match[2];
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

// Compact relative time ("now", "5m", "3h", "2d", else a short date). Used in
// message lists, notifications, and conversation previews.
export function formatRelativeTime(ts: string | null | undefined): string {
  if (!ts) return "";
  const then = new Date(ts).getTime();
  if (isNaN(then)) return "";
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return new Date(then).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Clock time for a message bubble ("3:04 PM").
export function formatClockTime(ts: string | null | undefined): string {
  if (!ts) return "";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function titleCase(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function isPastDate(date: string | null): boolean {
  if (!date) return false;
  const d = new Date(date.length <= 10 ? `${date}T23:59:59` : date);
  if (isNaN(d.getTime())) return false;
  return d.getTime() < Date.now();
}

// Category metadata -------------------------------------------------------

// Constrained by the events_category_check on the existing database.
export const EVENT_CATEGORIES = ["party", "social", "academic", "other"] as const;

// Curated cover images (Unsplash) for the event create flow — storage uploads
// are RLS-locked on this project, so hosts pick a preset or paste an image URL.
export const COVER_PRESETS: string[] = [
  "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&h=675&fit=crop",
  "https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=1200&h=675&fit=crop",
  "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=1200&h=675&fit=crop",
  "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1200&h=675&fit=crop",
  "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=1200&h=675&fit=crop",
  "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=1200&h=675&fit=crop",
  "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=1200&h=675&fit=crop",
  "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1200&h=675&fit=crop",
  "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?w=1200&h=675&fit=crop",
  "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=1200&h=675&fit=crop",
  "https://images.unsplash.com/photo-1543007630-9710e4a00a20?w=1200&h=675&fit=crop",
  "https://images.unsplash.com/photo-1505236858219-8359eb29e329?w=1200&h=675&fit=crop",
];

export const PROVIDER_CATEGORIES = [
  "barbers",
  "photography",
  "hair",
  "beauty",
  "food",
  "tutoring",
  "events",
  "fitness",
  "other",
] as const;

// Curated cover/work images (Unsplash) for the provider setup flow — storage
// uploads are RLS-locked on this project, so providers pick presets or paste URLs.
export const PROVIDER_COVER_PRESETS: string[] = [
  "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=1200&h=675&fit=crop",
  "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=1200&h=675&fit=crop",
  "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?w=1200&h=675&fit=crop",
  "https://images.unsplash.com/photo-1554519515-242161756769?w=1200&h=675&fit=crop",
  "https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=1200&h=675&fit=crop",
  "https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=1200&h=675&fit=crop",
  "https://images.unsplash.com/photo-1556760544-74068565f05c?w=1200&h=675&fit=crop",
  "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=1200&h=675&fit=crop",
  "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=1200&h=675&fit=crop",
  "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1200&h=675&fit=crop",
  "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=1200&h=675&fit=crop",
  "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=1200&h=675&fit=crop",
];
