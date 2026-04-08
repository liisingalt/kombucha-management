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

export interface Material {
  id: number;
  title: string;
  content: string;
  sourceUrl?: string | null;
  type: string;
  createdAt: string;
}

export async function listMaterials(adminKey: string): Promise<Material[]> {
  const res = await fetch(`${API_BASE}/persona/materials`, {
    headers: { "x-admin-key": adminKey },
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error("Unauthorized");
    throw new Error("Failed to list materials");
  }
  return res.json();
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

export async function importBlog(adminKey: string, url: string): Promise<{ imported: number; articles: { id: number; title: string; sourceUrl?: string | null; type: string; createdAt: string }[] }> {
  const res = await fetch(`${API_BASE}/persona/import-blog`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-admin-key": adminKey },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || "Failed to import blog");
  }
  return res.json();
}

export interface BlogArticle {
  id: number;
  title: string;
  content: string;
  sourceUrl?: string | null;
  createdAt: string;
}

export async function listBlogArticles(): Promise<BlogArticle[]> {
  const res = await fetch(`${API_BASE}/persona/blog`);
  if (!res.ok) throw new Error("Failed to load articles");
  return res.json();
}

export async function getBlogArticle(id: number): Promise<BlogArticle> {
  const res = await fetch(`${API_BASE}/persona/blog/${id}`);
  if (!res.ok) throw new Error("Article not found");
  return res.json();
}
