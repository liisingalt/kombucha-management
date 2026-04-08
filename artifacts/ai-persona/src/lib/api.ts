const API_BASE = "/api";

export async function personaChat(message: string, history: { role: string; content: string }[]) {
  const res = await fetch(`${API_BASE}/persona/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
  });
  if (!res.ok) throw new Error("Failed to get response");
  return res.json() as Promise<{ reply: string }>;
}

export async function listMaterials(adminKey: string) {
  const res = await fetch(`${API_BASE}/persona/materials`, {
    headers: { "x-admin-key": adminKey },
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error("Unauthorized");
    throw new Error("Failed to list materials");
  }
  return res.json() as Promise<{ id: number; title: string; content: string; createdAt: string }[]>;
}

export async function createMaterial(adminKey: string, title: string, content: string) {
  const res = await fetch(`${API_BASE}/persona/materials`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
    body: JSON.stringify({ title, content }),
  });
  if (!res.ok) throw new Error("Failed to create material");
  return res.json();
}

export async function deleteMaterial(adminKey: string, id: number) {
  const res = await fetch(`${API_BASE}/persona/materials/${id}`, {
    method: "DELETE",
    headers: { "x-admin-key": adminKey },
  });
  if (!res.ok) throw new Error("Failed to delete material");
}
