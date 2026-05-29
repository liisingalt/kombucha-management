import { API_BASE } from "@/lib/apiBase";

export function getPhotoUrl(objectPath: string): string {
  const stripped = objectPath.startsWith("/objects/")
    ? objectPath.slice("/objects/".length)
    : objectPath.replace(/^\/+/, "");
  return `${API_BASE}/api/storage/objects/${stripped}`;
}
