import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { listMaterials, createMaterial, deleteMaterial } from "@/lib/api";
import { Loader2, Trash2, Plus, ArrowLeft, Lock, FileText, AlertCircle } from "lucide-react";
import { Link } from "wouter";

interface Material {
  id: number;
  title: string;
  content: string;
  createdAt: string;
}

function AdminLogin({ onLogin }: { onLogin: (key: string) => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await listMaterials(password);
      onLogin(password);
    } catch {
      setError("Incorrect admin password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <CardTitle>Admin Panel</CardTitle>
          <CardDescription>Enter your admin password to manage persona materials.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <Label htmlFor="password">Admin Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password"
                className="mt-1"
              />
            </div>
            {error && (
              <div className="flex gap-2 items-center text-sm text-destructive">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}
            <Button type="submit" disabled={!password || loading} className="w-full">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Sign In
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState<string | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  useEffect(() => {
    if (adminKey) {
      loadMaterials();
    }
  }, [adminKey]);

  async function loadMaterials() {
    setLoading(true);
    setError(null);
    try {
      const data = await listMaterials(adminKey!);
      setMaterials(data);
    } catch {
      setError("Failed to load materials.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await createMaterial(adminKey!, title.trim(), content.trim());
      setTitle("");
      setContent("");
      await loadMaterials();
    } catch {
      setError("Failed to add material.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    setError(null);
    try {
      await deleteMaterial(adminKey!, id);
      setMaterials((prev) => prev.filter((m) => m.id !== id));
    } catch {
      setError("Failed to delete material.");
    } finally {
      setDeletingId(null);
    }
  }

  if (!adminKey) {
    return <AdminLogin onLogin={setAdminKey} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
              <ArrowLeft className="w-4 h-4" />
              Back to Chat
            </Button>
          </Link>
          <h1 className="font-semibold text-sm">Persona Admin</h1>
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setAdminKey(null)}>
            Sign Out
          </Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-8">
        <section>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Plus className="w-4 h-4" />
                Add Material
              </CardTitle>
              <CardDescription>
                Paste writings, Q&As, essays, or any text that captures your voice and perspective. The AI will use these when responding to visitors.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAdd} className="flex flex-col gap-3">
                <div>
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. My View on Creativity"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="content">Content</Label>
                  <Textarea
                    id="content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Paste your writing, Q&A, or any personal material here..."
                    rows={8}
                    className="mt-1 resize-none"
                  />
                </div>
                {error && (
                  <div className="flex gap-2 items-center text-sm text-destructive">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </div>
                )}
                <Button type="submit" disabled={!title.trim() || !content.trim() || submitting}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                  Add Material
                </Button>
              </form>
            </CardContent>
          </Card>
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              Uploaded Materials
              {materials.length > 0 && (
                <span className="ml-1 text-xs text-muted-foreground font-normal">({materials.length})</span>
              )}
            </h2>
            <Button variant="ghost" size="sm" onClick={loadMaterials} disabled={loading}>
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Refresh"}
            </Button>
          </div>

          {loading && materials.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading materials...
            </div>
          ) : materials.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <FileText className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">No materials yet. Add your first one above.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {materials.map((mat) => (
                <Card key={mat.id} className="group">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm truncate">{mat.title}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(mat.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                          {" · "}
                          {mat.content.length.toLocaleString()} characters
                        </p>
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-3 leading-relaxed">
                          {mat.content}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="flex-shrink-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleDelete(mat.id)}
                        disabled={deletingId === mat.id}
                        title="Delete material"
                      >
                        {deletingId === mat.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
