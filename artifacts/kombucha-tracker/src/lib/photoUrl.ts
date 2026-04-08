const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function getPhotoUrl(objectPath: string): string {
  const stripped = objectPath.startsWith("/objects/")
    ? objectPath.slice("/objects/".length)
    : objectPath.replace(/^\/+/, "");
  return `${basePath}/api/storage/objects/${stripped}`;
}
