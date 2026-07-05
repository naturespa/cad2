import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const root = process.cwd();
const port = Number(process.env.PORT || 8000);

const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".stl": "model/stl",
};

async function fetchWithTimeout(url, options = {}, timeoutMs = 6000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJson(url) {
  const result = await fetchWithTimeout(url, {
    headers: {
      "Accept": "application/json",
      "User-Agent": "cad2-local-reference/1.0",
    },
  });

  if (!result.ok) {
    throw new Error(`HTTP ${result.status}`);
  }

  return result.json();
}

async function fetchText(url) {
  const result = await fetchWithTimeout(url, {
    headers: {
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "ja,en;q=0.8",
      "User-Agent": "Mozilla/5.0 cad2-local-reference/1.0",
    },
  });

  if (!result.ok) {
    throw new Error(`HTTP ${result.status}`);
  }

  return result.text();
}

function decodeHtml(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function cleanHtml(value) {
  return decodeHtml(String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
}

function parseDuckSearchHtml(html, limit = 5) {
  const results = [];
  const resultPattern = /<a[^>]+class="[^"]*result__a[^"]*"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(resultPattern)) {
    const title = cleanHtml(match[1]);
    const text = cleanHtml(match[2]);
    if (title || text) {
      results.push({ source: "Web検索", title, text });
    }
    if (results.length >= limit) {
      break;
    }
  }

  return results;
}

function timeoutValue(ms, value) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(value), ms);
  });
}

function flattenDuckTopics(topics, output = []) {
  for (const topic of topics || []) {
    if (topic.Text) {
      output.push(topic.Text);
    }
    if (topic.Topics) {
      flattenDuckTopics(topic.Topics, output);
    }
  }
  return output;
}

async function referenceSearch(query) {
  const duckSearchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`${query} 形状 構造`)}`;
  const wikiSearchUrl = `https://ja.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srlimit=1&srsearch=${encodeURIComponent(query)}`;
  const duckUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;

  const [searchResult, duckResult, wikiResult] = await Promise.allSettled([
    fetchText(duckSearchUrl),
    fetchJson(duckUrl),
    fetchJson(wikiSearchUrl),
  ]);

  const references = [];

  if (searchResult.status === "fulfilled") {
    references.push(...parseDuckSearchHtml(searchResult.value));
  }

  if (duckResult.status === "fulfilled") {
    const duck = duckResult.value;
    const related = flattenDuckTopics(duck.RelatedTopics).slice(0, 4);
    if (duck.Heading || duck.AbstractText || related.length) {
      references.push({
        source: "DuckDuckGo",
        title: duck.Heading || query,
        text: [duck.AbstractText, ...related].filter(Boolean).join(" "),
      });
    }
  }

  if (wikiResult.status === "fulfilled") {
    const page = wikiResult.value?.query?.search?.[0];
    if (page?.title) {
      references.push({
        source: "Wikipedia",
        title: page.title,
        text: String(page.snippet || "").replace(/<[^>]*>/g, ""),
      });
    }
  }

  return references;
}

createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://localhost:${port}`);

  if (url.pathname === "/api/reference") {
    const query = (url.searchParams.get("q") || "").trim();
    response.setHeader("Content-Type", "application/json; charset=utf-8");

    if (!query) {
      response.writeHead(400);
      response.end(JSON.stringify({ ok: false, references: [], error: "Missing query" }));
      return;
    }

    try {
      const references = await Promise.race([
        referenceSearch(query),
        timeoutValue(5000, []),
      ]);
      response.writeHead(200);
      response.end(JSON.stringify({ ok: true, query, references }));
    } catch (error) {
      response.writeHead(200);
      response.end(JSON.stringify({ ok: false, query, references: [], error: error.message }));
    }
    return;
  }

  const requested = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
  let filePath = join(root, requested === "/" ? "index.html" : requested);

  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = join(root, "index.html");
  }

  response.writeHead(200, {
    "Content-Type": types[extname(filePath)] || "application/octet-stream",
  });
  createReadStream(filePath).pipe(response);
}).listen(port, () => {
  console.log(`cad2 is running at http://localhost:${port}`);
});
