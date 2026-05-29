import { useState, useEffect, useRef } from "react";
import { useRoute, Link } from "wouter";
import { getBlogArticle, type BlogArticle } from "@/lib/api";
import { Loader2, ArrowLeft, Calendar, ExternalLink, Copy, Check, Download, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function buildExcerpt(content: string, maxLen = 280): string {
  const text = content.replace(/\s+/g, " ").trim();
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).replace(/\s\S*$/, "") + "…";
}

function buildCaption(article: BlogArticle): string {
  const excerpt = buildExcerpt(article.content, 220);
  const sourceTag = article.sourceUrl ? `\n\nRead more: ${article.sourceUrl}` : "";
  return `${article.title}\n\n${excerpt}${sourceTag}\n\n#kombucha #fermentation #brewing`;
}

function useImageCard(article: BlogArticle | null) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!article || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = 1080;
    const H = 1080;
    canvas.width = W;
    canvas.height = H;

    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, "#78350f");
    grad.addColorStop(0.5, "#92400e");
    grad.addColorStop(1, "#b45309");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.beginPath();
    ctx.arc(W * 0.85, H * 0.15, 280, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(W * 0.1, H * 0.85, 200, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 2;
    ctx.strokeRect(48, 48, W - 96, H - 96);

    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.fillRect(64, 64, 6, 80);

    ctx.fillStyle = "#fef3c7";
    ctx.font = "bold 28px Georgia, serif";
    ctx.fillText("✦ Article", 88, 115);

    const title = article.title;
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 62px Georgia, serif";
    const maxTitleWidth = W - 128;
    const words = title.split(" ");
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxTitleWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    const lineH = 76;
    const titleY = 220;
    lines.slice(0, 4).forEach((l, i) => {
      ctx.fillText(l, 64, titleY + i * lineH);
    });

    const dividerY = titleY + Math.min(lines.length, 4) * lineH + 40;
    ctx.strokeStyle = "rgba(254,243,199,0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(64, dividerY);
    ctx.lineTo(W - 64, dividerY);
    ctx.stroke();

    const pullQuote = buildExcerpt(article.content, 300);
    ctx.fillStyle = "#fde68a";
    ctx.font = "italic 32px Georgia, serif";
    const quoteWords = pullQuote.split(" ");
    const qLines: string[] = [];
    let qLine = "";
    const maxQWidth = W - 160;
    for (const word of quoteWords) {
      const test = qLine ? `${qLine} ${word}` : word;
      if (ctx.measureText(test).width > maxQWidth && qLine) {
        qLines.push(qLine);
        qLine = word;
      } else {
        qLine = test;
      }
    }
    if (qLine) qLines.push(qLine);
    const qLineH = 48;
    const qY = dividerY + 50;
    qLines.slice(0, 8).forEach((l, i) => {
      ctx.fillText(l, 80, qY + i * qLineH);
    });

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "20px Georgia, serif";
    ctx.fillText(formatDate(article.createdAt), 64, H - 64);
  }, [article]);

  return canvasRef;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
      {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copied!" : "Copy caption"}
    </Button>
  );
}

function ImageCardSection({ article }: { article: BlogArticle }) {
  const canvasRef = useImageCard(article);
  const [downloading, setDownloading] = useState(false);

  function handleDownload() {
    if (!canvasRef.current) return;
    setDownloading(true);
    try {
      const link = document.createElement("a");
      link.download = `${article.title.slice(0, 40).replace(/[^a-z0-9]/gi, "-")}-card.png`;
      link.href = canvasRef.current.toDataURL("image/png");
      link.click();
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl overflow-hidden border border-border shadow-md" style={{ maxWidth: 400 }}>
        <canvas ref={canvasRef} className="w-full h-auto" style={{ display: "block" }} />
      </div>
      <Button onClick={handleDownload} disabled={downloading} className="gap-2 w-fit">
        <Download className="w-4 h-4" />
        Download image card
      </Button>
    </div>
  );
}

export default function BlogArticlePage() {
  const [, params] = useRoute("/blog/:id");
  const id = Number(params?.id);

  const [article, setArticle] = useState<BlogArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || isNaN(id)) {
      setError("Invalid article ID.");
      setLoading(false);
      return;
    }
    getBlogArticle(id)
      .then(setArticle)
      .catch(() => setError("Article not found."))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/blog">
            <button className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Blog
            </button>
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading…
          </div>
        ) : error || !article ? (
          <div className="py-20 text-center text-muted-foreground">{error || "Article not found."}</div>
        ) : (
          <>
            <article className="mb-12">
              <h1 className="text-3xl font-bold tracking-tight leading-tight mb-4">{article.title}</h1>
              <div className="flex items-center gap-4 text-xs text-muted-foreground mb-8">
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
                  >
                    <ExternalLink className="w-3 h-3" />
                    Original source
                  </a>
                )}
              </div>
              <div className="prose prose-neutral max-w-none text-foreground leading-relaxed">
                {article.content.split("\n").filter(Boolean).map((para, i) => (
                  <p key={i} className="mb-4 text-base leading-relaxed">{para}</p>
                ))}
              </div>
            </article>

            {/* Social sharing section */}
            <section className="border-t border-border pt-10">
              <div className="flex items-center gap-2 mb-6">
                <Share2 className="w-4 h-4 text-muted-foreground" />
                <h2 className="font-semibold text-base">Share this article</h2>
              </div>

              <div className="flex flex-col gap-6">
                {/* Caption copy */}
                <Card>
                  <CardContent className="pt-5">
                    <h3 className="font-medium text-sm mb-2">Instagram / Facebook caption</h3>
                    <p className="text-xs text-muted-foreground mb-3">Ready-to-paste social media caption with excerpt and hashtags.</p>
                    <div className="bg-muted/50 rounded-lg p-3 text-sm whitespace-pre-wrap leading-relaxed mb-3 max-h-40 overflow-y-auto font-mono text-xs">
                      {buildCaption(article)}
                    </div>
                    <CopyButton text={buildCaption(article)} />
                  </CardContent>
                </Card>

                {/* Image card */}
                <Card>
                  <CardContent className="pt-5">
                    <h3 className="font-medium text-sm mb-2">Shareable image card</h3>
                    <p className="text-xs text-muted-foreground mb-4">A branded visual quote card for Instagram, Facebook, or stories. Download and post directly.</p>
                    <ImageCardSection article={article} />
                  </CardContent>
                </Card>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
