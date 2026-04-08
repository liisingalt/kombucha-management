import { Router } from "express";
import { db } from "@workspace/db";
import { personaMaterialsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import type { Request, Response, NextFunction } from "express";
import {
  PersonaChatBody,
  CreatePersonaMaterialBody,
  DeletePersonaMaterialParams,
  ImportBlogBody,
  GetBlogArticleParams,
} from "@workspace/api-zod";

const router = Router();

const PERSONA_ADMIN_SECRET = process.env.PERSONA_ADMIN_SECRET ?? "";
const INSECURE_DEFAULTS = new Set(["", "change-me-in-production", "changeme", "secret", "admin"]);

function requireAdminKey(req: Request, res: Response, next: NextFunction): void {
  const key = req.headers["x-admin-key"] as string | undefined;
  if (INSECURE_DEFAULTS.has(PERSONA_ADMIN_SECRET)) {
    res.status(503).json({ error: "Admin panel disabled: configure PERSONA_ADMIN_SECRET as a secure Replit Secret" });
    return;
  }
  if (!key || key !== PERSONA_ADMIN_SECRET) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

router.get("/persona/materials", requireAdminKey, async (req, res) => {
  try {
    const materials = await db.query.personaMaterialsTable.findMany({
      orderBy: [desc(personaMaterialsTable.createdAt)],
    });
    res.json(materials);
  } catch (err) {
    req.log.error({ err }, "Failed to list persona materials");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/persona/materials", requireAdminKey, async (req, res) => {
  const parsed = CreatePersonaMaterialBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "title and content are required", details: parsed.error.flatten() });
    return;
  }

  const { title, content } = parsed.data;

  try {
    const [material] = await db
      .insert(personaMaterialsTable)
      .values({ title, content, type: "manual" })
      .returning();
    res.status(201).json(material);
  } catch (err) {
    req.log.error({ err }, "Failed to create persona material");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/persona/materials/:id", requireAdminKey, async (req, res) => {
  const parsed = DeletePersonaMaterialParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const id = parsed.data.id;

  try {
    const deleted = await db
      .delete(personaMaterialsTable)
      .where(eq(personaMaterialsTable.id, id))
      .returning();

    if (deleted.length === 0) {
      res.status(404).json({ error: "Material not found" });
      return;
    }

    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to delete persona material");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Blog import ──────────────────────────────────────────────────────────────

function isSsrfUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return true;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return true;
  const hostname = parsed.hostname.toLowerCase();
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") return true;
  if (/^10\./.test(hostname)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return true;
  if (/^192\.168\./.test(hostname)) return true;
  if (/^169\.254\./.test(hostname)) return true;
  if (/^fc00:/i.test(hostname) || /^fd[0-9a-f]{2}:/i.test(hostname)) return true;
  return false;
}

interface ParsedArticle {
  title: string;
  content: string;
  sourceUrl: string;
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function parseRssFeed(xml: string, feedUrl: string): ParsedArticle[] {
  const items: ParsedArticle[] = [];

  const itemMatches = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ||
    xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];

  for (const item of itemMatches) {
    const titleMatch = item.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
    const linkMatch = item.match(/<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i) ||
      item.match(/<link[^>]+href=["']([^"']+)["']/i);
    const contentMatch = item.match(/<content:encoded[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/content:encoded>/i) ||
      item.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i) ||
      item.match(/<summary[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/summary>/i);

    const title = titleMatch ? stripHtml(titleMatch[1].trim()) : "";
    const link = linkMatch ? linkMatch[1].trim() : feedUrl;
    const rawContent = contentMatch ? contentMatch[1].trim() : "";
    const content = rawContent.startsWith("<") ? stripHtml(rawContent) : rawContent;

    if (title && content && content.length > 50) {
      items.push({ title, content: content.slice(0, 10000), sourceUrl: link });
    }
  }

  return items.slice(0, 20);
}

function parseHtmlBlogPosts(html: string, baseUrl: string): ParsedArticle[] {
  const articles: ParsedArticle[] = [];

  const articleMatches = html.match(/<article[^>]*>[\s\S]*?<\/article>/gi) || [];

  for (const articleHtml of articleMatches.slice(0, 15)) {
    const titleMatch = articleHtml.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i);
    const title = titleMatch ? stripHtml(titleMatch[1]) : "";

    const bodyMatch = articleHtml.match(/<(?:p|div)[^>]*>([\s\S]*?)<\/(?:p|div)>/gi);
    const bodyText = bodyMatch
      ? bodyMatch.map(p => stripHtml(p)).filter(t => t.length > 20).join(" ")
      : "";

    if (title && bodyText.length > 50) {
      articles.push({ title, content: bodyText.slice(0, 10000), sourceUrl: baseUrl });
    }
  }

  return articles;
}

router.post("/persona/import-blog", requireAdminKey, async (req, res) => {
  const parsed = ImportBlogBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "A valid URL is required", details: parsed.error.flatten() });
    return;
  }

  const { url } = parsed.data;

  if (isSsrfUrl(url)) {
    res.status(400).json({ error: "The provided URL is not allowed." });
    return;
  }

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; BlogImporter/1.0)", "Accept": "application/rss+xml, application/atom+xml, text/html, */*" },
    });

    if (!response.ok) {
      res.status(400).json({ error: `Failed to fetch URL: ${response.status} ${response.statusText}` });
      return;
    }

    const contentType = response.headers.get("content-type") || "";
    const body = await response.text();

    let articles: ParsedArticle[] = [];

    const isXml = contentType.includes("xml") || contentType.includes("rss") || contentType.includes("atom") ||
      body.trimStart().startsWith("<?xml") || body.includes("<rss") || body.includes("<feed");

    if (isXml) {
      articles = parseRssFeed(body, url);
    } else {
      const rssLinkMatch = body.match(/<link[^>]+type=["']application\/(?:rss|atom)\+xml["'][^>]+href=["']([^"']+)["']/i) ||
        body.match(/<link[^>]+href=["']([^"']+)["'][^>]+type=["']application\/(?:rss|atom)\+xml["']/i);

      if (rssLinkMatch) {
        const rssUrl = rssLinkMatch[1].startsWith("http") ? rssLinkMatch[1] : new URL(rssLinkMatch[1], url).href;
        if (isSsrfUrl(rssUrl)) {
          articles = [];
        } else
        try {
          const rssResponse = await fetch(rssUrl, {
            headers: { "User-Agent": "Mozilla/5.0 (compatible; BlogImporter/1.0)" },
          });
          if (rssResponse.ok) {
            const rssBody = await rssResponse.text();
            articles = parseRssFeed(rssBody, rssUrl);
          }
        } catch {
          // fall through to HTML parsing
        }
      }

      if (articles.length === 0) {
        articles = parseHtmlBlogPosts(body, url);
      }
    }

    if (articles.length === 0) {
      res.status(422).json({ error: "No articles found at the provided URL. Try providing a direct RSS/Atom feed URL." });
      return;
    }

    // De-duplicate: skip articles whose sourceUrl already exists in the DB
    const existingUrls = new Set(
      (await db.query.personaMaterialsTable.findMany({
        where: eq(personaMaterialsTable.type, "article"),
        columns: { sourceUrl: true },
      }))
        .map(a => a.sourceUrl)
        .filter(Boolean)
    );

    const newArticles = articles.filter(
      a => !a.sourceUrl || !existingUrls.has(a.sourceUrl)
    );

    if (newArticles.length === 0) {
      res.status(200).json({ imported: 0, articles: [], message: "All articles already imported." });
      return;
    }

    const inserted = await db
      .insert(personaMaterialsTable)
      .values(newArticles.map(a => ({
        title: a.title,
        content: a.content,
        sourceUrl: a.sourceUrl,
        type: "article",
      })))
      .returning();

    res.status(201).json({
      imported: inserted.length,
      articles: inserted.map(a => ({
        id: a.id,
        title: a.title,
        sourceUrl: a.sourceUrl,
        type: a.type,
        createdAt: a.createdAt,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to import blog");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Public blog endpoints ────────────────────────────────────────────────────

router.get("/persona/blog", async (req, res) => {
  try {
    const articles = await db.query.personaMaterialsTable.findMany({
      where: eq(personaMaterialsTable.type, "article"),
      orderBy: [desc(personaMaterialsTable.createdAt)],
    });
    res.json(articles.map(a => ({
      id: a.id,
      title: a.title,
      content: a.content,
      sourceUrl: a.sourceUrl,
      createdAt: a.createdAt,
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to list blog articles");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/persona/blog/:id", async (req, res) => {
  const parsed = GetBlogArticleParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  try {
    const article = await db.query.personaMaterialsTable.findFirst({
      where: eq(personaMaterialsTable.id, parsed.data.id),
    });

    if (!article || article.type !== "article") {
      res.status(404).json({ error: "Article not found" });
      return;
    }

    res.json({
      id: article.id,
      title: article.title,
      content: article.content,
      sourceUrl: article.sourceUrl,
      createdAt: article.createdAt,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get blog article");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Persona chat ─────────────────────────────────────────────────────────────

router.post("/persona/chat", async (req, res) => {
  const parsed = PersonaChatBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "message is required", details: parsed.error.flatten() });
    return;
  }

  const { message, history } = parsed.data;

  try {
    const materials = await db.query.personaMaterialsTable.findMany({
      orderBy: [desc(personaMaterialsTable.createdAt)],
    });

    const MAX_CONTEXT_CHARS = 12000;
    let contextText = "";
    for (const mat of materials) {
      const snippet = `--- ${mat.title} ---\n${mat.content}\n\n`;
      if (contextText.length + snippet.length > MAX_CONTEXT_CHARS) break;
      contextText += snippet;
    }

    const systemPrompt = contextText
      ? `You are a digital persona — an AI that speaks, thinks, and responds exactly as the person whose writings and ideas are provided below. When you answer, draw directly from these materials to reflect their authentic voice, worldview, and style. Do not break character. If you don't have information on a topic from the materials, answer in a way that feels consistent with their overall voice and perspective.

Here are the owner's personal writings, Q&As, and ideas:

${contextText}`
      : "You are a helpful AI assistant. Answer questions thoughtfully and honestly.";

    const conversationMessages = (history ?? []).slice(-8).map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    }));

    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 600,
      messages: [
        { role: "system", content: systemPrompt },
        ...conversationMessages,
        { role: "user", content: message },
      ],
    });

    const reply = response.choices[0]?.message?.content ?? "I'm unable to respond right now.";
    res.json({ reply });
  } catch (err) {
    req.log.error({ err }, "Failed to run persona chat");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
