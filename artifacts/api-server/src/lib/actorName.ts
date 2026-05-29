import { clerkClient } from "@clerk/express";

type CacheEntry = { name: string; expiresAt: number };
const cache = new Map<string, CacheEntry>();
const TTL_MS = 60 * 60 * 1000;

export async function resolveActorName(userId: string): Promise<string | null> {
  const cached = cache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.name;
  try {
    const user = await clerkClient.users.getUser(userId);
    const name =
      [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
      user.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ||
      user.emailAddresses?.[0]?.emailAddress ||
      null;
    if (name) cache.set(userId, { name, expiresAt: Date.now() + TTL_MS });
    return name;
  } catch {
    return null;
  }
}
