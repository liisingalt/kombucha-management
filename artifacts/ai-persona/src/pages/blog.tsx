import { useState, useEffect } from "react";
import { Link } from "wouter";
import { listBlogArticles, type BlogArticle } from "@/lib/api";
import { Loader2, BookOpen, ArrowLeft, Calendar, ExternalLink } from "lucide-react";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function excerpt(content: string, maxLen = 200) {
  const text = content.replace(/\s+/g, " ").trim();
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).replace(/\s\S*$/, "") + "…";
}

export default function BlogPage() {
  const [articles, setArticles] = useState<BlogArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listBlogArticles()
      .then(setArticles)
      .catch(() => setError("Failed to load articles."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/">
            <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          </Link>
          <h1 className="font-semibold text-sm">Blog</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h2 className="text-3xl font-bold tracking-tight">Articles</h2>
          <p className="text-muted-foreground mt-2">Insights, ideas, and perspectives.</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading articles…
          </div>
        ) : error ? (
          <div className="py-20 text-center text-muted-foreground">{error}</div>
        ) : articles.length === 0 ? (
          <div className="py-20 text-center">
            <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-muted-foreground">No articles yet.</p>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {articles.map((article) => (
              <article key={article.id} className="py-7 first:pt-0">
                <Link href={`/blog/${article.id}`}>
                  <h3 className="text-xl font-semibold hover:text-primary transition-colors cursor-pointer leading-snug mb-2">
                    {article.title}
                  </h3>
                </Link>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatDate(article.createdAt)}
                  </span>
                  {article.sourceUrl && (
                    <a
                      href={article.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 hover:text-primary transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="w-3 h-3" />
                      Original
                    </a>
                  )}
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed">{excerpt(article.content)}</p>
                <Link href={`/blog/${article.id}`}>
                  <button className="mt-3 text-sm text-primary font-medium hover:underline">
                    Read more →
                  </button>
                </Link>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
