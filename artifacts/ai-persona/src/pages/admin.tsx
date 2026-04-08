import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { listMaterials, createMaterial, deleteMaterial, importBlog, type Material } from "@/lib/api";
import { Loader2, Trash2, Plus, ArrowLeft, Lock, FileText, AlertCircle, Rss, ExternalLink, ChevronDown, ChevronUp, Globe } from "lucide-react";
import { Link } from "wouter";

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

function ArticleCard({
  mat,
  onDelete,
  deletingId,
}: {
  mat: Material;
  onDelete: (id: number) => void;
  deletingId: number | null;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="group">
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-medium text-sm truncate">{mat.title}</h3>
              {mat.sourceUrl && (
                <a
                  href={mat.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="w-3 h-3" />
                  Source
                </a>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {new Date(mat.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
              {" · "}
              {mat.content.length.toLocaleString()} characters
            </p>
            {expanded ? (
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed whitespace-pre-wrap">
                {mat.content}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground mt-2 line-clamp-3 leading-relaxed">
                {mat.content}
              </p>
            )}
            <button
              className="text-xs text-primary mt-1 flex items-center gap-0.5 hover:underline"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <><ChevronUp className="w-3 h-3" /> Show less</>
              ) : (
                <><ChevronDown className="w-3 h-3" /> Read full</>
              )}
            </button>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="flex-shrink-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => onDelete(mat.id)}
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

  const [blogUrl, setBlogUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

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

  async function handleImportBlog(e: React.FormEvent) {
    e.preventDefault();
    if (!blogUrl.trim()) return;
    setImporting(true);
    setImportError(null);
    setImportResult(null);
    try {
      const result = await importBlog(adminKey!, blogUrl.trim());
      setImportResult({ imported: result.imported });
      setBlogUrl("");
      await loadMaterials();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Failed to import blog.");
    } finally {
      setImporting(false);
    }
  }

  if (!adminKey) {
    return <AdminLogin onLogin={setAdminKey} />;
  }

  const articles = materials.filter((m) => m.type === "article");
  const manualMaterials = materials.filter((m) => m.type !== "article");

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

        {/* Blog Import Section */}
        <section>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Rss className="w-4 h-4" />
                Import from Blog
              </CardTitle>
              <CardDescription>
                Paste a blog URL or RSS/Atom feed URL to automatically import articles as persona knowledge material.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleImportBlog} className="flex flex-col gap-3">
                <div>
                  <Label htmlFor="blogUrl">Blog or RSS URL</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      id="blogUrl"
                      type="url"
                      value={blogUrl}
                      onChange={(e) => setBlogUrl(e.target.value)}
                      placeholder="https://yourblog.com/feed or https://yourblog.com"
                      className="flex-1"
                    />
                    <Button type="submit" disabled={!blogUrl.trim() || importing}>
                      {importing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Globe className="w-4 h-4 mr-2" />}
                      Import
                    </Button>
                  </div>
                </div>
                {importResult && (
                  <div className="flex gap-2 items-center text-sm text-green-600">
                    <FileText className="w-4 h-4 flex-shrink-0" />
                    Successfully imported {importResult.imported} article{importResult.imported !== 1 ? "s" : ""}.
                  </div>
                )}
                {importError && (
                  <div className="flex gap-2 items-center text-sm text-destructive">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {importError}
                  </div>
                )}
              </form>
            </CardContent>
          </Card>
        </section>

        {/* Manual Add Section */}
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

        {/* Imported Articles Section */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold flex items-center gap-2">
              <Rss className="w-4 h-4 text-muted-foreground" />
              Imported Articles
              {articles.length > 0 && (
                <span className="ml-1 text-xs text-muted-foreground font-normal">({articles.length})</span>
              )}
            </h2>
            <Button variant="ghost" size="sm" onClick={loadMaterials} disabled={loading}>
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Refresh"}
            </Button>
          </div>

          {loading && articles.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading...
            </div>
          ) : articles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
              <Rss className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">No imported articles yet. Use the import tool above.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {articles.map((mat) => (
                <ArticleCard key={mat.id} mat={mat} onDelete={handleDelete} deletingId={deletingId} />
              ))}
            </div>
          )}
        </section>

        {/* Manual Materials Section */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              Uploaded Materials
              {manualMaterials.length > 0 && (
                <span className="ml-1 text-xs text-muted-foreground font-normal">({manualMaterials.length})</span>
              )}
            </h2>
          </div>

          {loading && manualMaterials.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading materials...
            </div>
          ) : manualMaterials.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
              <FileText className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">No materials yet. Add your first one above.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {manualMaterials.map((mat) => (
                <ArticleCard key={mat.id} mat={mat} onDelete={handleDelete} deletingId={deletingId} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
