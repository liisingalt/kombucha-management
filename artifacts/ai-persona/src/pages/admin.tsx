import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { listMaterials, createMaterial, deleteMaterial, importBlog, listScobyConds, createScobyCondition, deleteScobyCondition, uploadMaterialFile, type Material, type ScobyCondition } from "@/lib/api";
import { Loader2, Trash2, Plus, ArrowLeft, Lock, FileText, AlertCircle, Rss, ExternalLink, ChevronDown, ChevronUp, Globe, FlaskConical, CheckCircle2, XCircle, ImageIcon, Upload } from "lucide-react";
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

function ScobyConditionCard({
  cond,
  adminKey,
  onDelete,
  deletingId,
}: {
  cond: ScobyCondition;
  adminKey: string;
  onDelete: (id: number) => void;
  deletingId: number | null;
}) {
  const imageId = cond.imageUrl.replace(/^\/objects\/scoby\//, "");
  const imageSrc = `/api/scoby/images/${imageId}?k=${encodeURIComponent(adminKey)}`;

  return (
    <Card className="group">
      <CardContent className="pt-4">
        <div className="flex gap-4">
          <div className="flex-shrink-0 w-24 h-24 rounded-md overflow-hidden bg-muted border">
            <img
              src={imageSrc}
              alt="SCOBY"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {cond.isOk ? (
                  <span className="flex items-center gap-1 text-xs font-medium text-green-600">
                    <CheckCircle2 className="w-4 h-4" />
                    OK
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs font-medium text-destructive">
                    <XCircle className="w-4 h-4" />
                    Mitte OK
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {new Date(cond.createdAt).toLocaleDateString("et-EE", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="flex-shrink-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => onDelete(cond.id)}
                disabled={deletingId === cond.id}
                title="Kustuta kirje"
              >
                {deletingId === cond.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </Button>
            </div>
            {cond.isOk && cond.okReason && (
              <div className="mt-1">
                <span className="text-xs font-medium text-muted-foreground">Miks on OK: </span>
                <span className="text-xs text-foreground">{cond.okReason}</span>
              </div>
            )}
            {!cond.isOk && cond.notOkReason && (
              <div className="mt-1">
                <span className="text-xs font-medium text-muted-foreground">Miks ei ole OK: </span>
                <span className="text-xs text-foreground">{cond.notOkReason}</span>
              </div>
            )}
            <div className="mt-1">
              <span className="text-xs font-medium text-muted-foreground">Mida teha: </span>
              <span className="text-xs text-foreground">{cond.whatToDo}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ScobySection({ adminKey }: { adminKey: string }) {
  const [conditions, setConditions] = useState<ScobyCondition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isOk, setIsOk] = useState<boolean>(true);
  const [okReason, setOkReason] = useState("");
  const [notOkReason, setNotOkReason] = useState("");
  const [whatToDo, setWhatToDo] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadConditions();
  }, []);

  async function loadConditions() {
    setLoading(true);
    setError(null);
    try {
      const data = await listScobyConds(adminKey);
      setConditions(data);
    } catch {
      setError("Seisundite laadimine ebaõnnestus.");
    } finally {
      setLoading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setImageFile(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setImagePreview(url);
    } else {
      setImagePreview(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!imageFile) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const fd = new FormData();
      fd.append("image", imageFile);
      fd.append("is_ok", String(isOk));
      if (isOk && okReason.trim()) fd.append("ok_reason", okReason.trim());
      if (!isOk && notOkReason.trim()) fd.append("not_ok_reason", notOkReason.trim());
      fd.append("what_to_do", whatToDo.trim());

      await createScobyCondition(adminKey, fd);
      setImageFile(null);
      setImagePreview(null);
      setOkReason("");
      setNotOkReason("");
      setWhatToDo("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadConditions();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Salvestamine ebaõnnestus.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    setError(null);
    try {
      await deleteScobyCondition(adminKey, id);
      setConditions((prev) => prev.filter((c) => c.id !== id));
    } catch {
      setError("Kustutamine ebaõnnestus.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <section>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="w-4 h-4" />
              Lisa uus SCOBY seisund
            </CardTitle>
            <CardDescription>
              Laadi üles SCOBY pilt, märgi kas see on OK või mitte ning lisa selgitused.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <Label>Pilt (JPG/PNG)</Label>
                <div className="mt-1 flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="gap-2"
                  >
                    <ImageIcon className="w-4 h-4" />
                    Vali pilt
                  </Button>
                  {imageFile && (
                    <span className="text-xs text-muted-foreground truncate max-w-xs">
                      {imageFile.name}
                    </span>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
                {imagePreview && (
                  <div className="mt-2 w-32 h-32 rounded-md overflow-hidden border bg-muted">
                    <img src={imagePreview} alt="Eelvaade" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>

              <div>
                <Label>Seisund</Label>
                <div className="flex gap-2 mt-1">
                  <Button
                    type="button"
                    variant={isOk ? "default" : "outline"}
                    size="sm"
                    className="gap-1"
                    onClick={() => setIsOk(true)}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    OK
                  </Button>
                  <Button
                    type="button"
                    variant={!isOk ? "destructive" : "outline"}
                    size="sm"
                    className="gap-1"
                    onClick={() => setIsOk(false)}
                  >
                    <XCircle className="w-4 h-4" />
                    Mitte OK
                  </Button>
                </div>
              </div>

              {isOk ? (
                <div>
                  <Label htmlFor="okReason">Miks on OK</Label>
                  <Textarea
                    id="okReason"
                    value={okReason}
                    onChange={(e) => setOkReason(e.target.value)}
                    placeholder="Kirjelda, miks see SCOBY on terve..."
                    rows={3}
                    className="mt-1 resize-none"
                  />
                </div>
              ) : (
                <div>
                  <Label htmlFor="notOkReason">Miks ei ole OK</Label>
                  <Textarea
                    id="notOkReason"
                    value={notOkReason}
                    onChange={(e) => setNotOkReason(e.target.value)}
                    placeholder="Kirjelda, mis on SCOBYga valesti..."
                    rows={3}
                    className="mt-1 resize-none"
                  />
                </div>
              )}

              <div>
                <Label htmlFor="whatToDo">Mida teha sellises olukorras</Label>
                <Textarea
                  id="whatToDo"
                  value={whatToDo}
                  onChange={(e) => setWhatToDo(e.target.value)}
                  placeholder="Kirjelda, milliseid samme peaks kasutaja tegema..."
                  rows={3}
                  className="mt-1 resize-none"
                />
              </div>

              {submitError && (
                <div className="flex gap-2 items-center text-sm text-destructive">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {submitError}
                </div>
              )}

              <Button
                type="submit"
                disabled={!imageFile || !whatToDo.trim() || submitting}
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" />Salvestamine...</>
                ) : (
                  <><Plus className="w-4 h-4 mr-2" />Salvesta seisund</>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-muted-foreground" />
            SCOBY seisundid
            {conditions.length > 0 && (
              <span className="ml-1 text-xs text-muted-foreground font-normal">({conditions.length})</span>
            )}
          </h2>
          <Button variant="ghost" size="sm" onClick={loadConditions} disabled={loading}>
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : "Värskenda"}
          </Button>
        </div>

        {error && (
          <div className="flex gap-2 items-center text-sm text-destructive mb-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {loading && conditions.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Laadimine...
          </div>
        ) : conditions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <FlaskConical className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-sm">Seisundeid pole veel lisatud.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {conditions.map((cond) => (
              <ScobyConditionCard
                key={cond.id}
                cond={cond}
                adminKey={adminKey}
                onDelete={handleDelete}
                deletingId={deletingId}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"persona" | "scoby">("persona");
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

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setUploadFile(file);
    setUploadError(null);
    setUploadSuccess(false);
    if (file) {
      setUploadTitle(file.name.replace(/\.[^.]+$/, ""));
    }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadFile || !uploadTitle.trim()) return;
    setUploading(true);
    setUploadError(null);
    setUploadSuccess(false);
    try {
      await uploadMaterialFile(adminKey!, uploadFile, uploadTitle.trim());
      setUploadFile(null);
      setUploadTitle("");
      setUploadSuccess(true);
      const fileInput = document.getElementById("uploadFile") as HTMLInputElement | null;
      if (fileInput) fileInput.value = "";
      await loadMaterials();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Failed to upload file.");
    } finally {
      setUploading(false);
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
        <div className="max-w-3xl mx-auto px-4 flex gap-1 pb-0">
          <button
            onClick={() => setActiveTab("persona")}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "persona"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Persona
          </button>
          <button
            onClick={() => setActiveTab("scoby")}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "scoby"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <FlaskConical className="w-3.5 h-3.5" />
            SCOBY
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {activeTab === "scoby" ? (
          <ScobySection adminKey={adminKey} />
        ) : (
          <div className="flex flex-col gap-8">
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

            {/* Upload File Section */}
            <section>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Upload className="w-4 h-4" />
                    Upload File
                  </CardTitle>
                  <CardDescription>
                    Upload a document or image to extract its content as persona material. Supported: .md, .pdf, .doc, .docx, .jpg, .jpeg, .png
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleUpload} className="flex flex-col gap-3">
                    <div>
                      <Label htmlFor="uploadFile">File</Label>
                      <Input
                        id="uploadFile"
                        type="file"
                        accept=".md,.pdf,.doc,.docx,.jpg,.jpeg,.png"
                        onChange={handleFileChange}
                        className="mt-1 cursor-pointer"
                      />
                    </div>
                    <div>
                      <Label htmlFor="uploadTitle">Title</Label>
                      <Input
                        id="uploadTitle"
                        value={uploadTitle}
                        onChange={(e) => setUploadTitle(e.target.value)}
                        placeholder="Title for this material"
                        className="mt-1"
                      />
                    </div>
                    {uploadSuccess && (
                      <div className="flex gap-2 items-center text-sm text-green-600">
                        <FileText className="w-4 h-4 flex-shrink-0" />
                        File uploaded and saved successfully.
                      </div>
                    )}
                    {uploadError && (
                      <div className="flex gap-2 items-center text-sm text-destructive">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        {uploadError}
                      </div>
                    )}
                    <Button type="submit" disabled={!uploadFile || !uploadTitle.trim() || uploading}>
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                      Upload
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </section>

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
          </div>
        )}
      </main>
    </div>
  );
}
