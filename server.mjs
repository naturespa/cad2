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

async function fetchJson(url) {
  const result = await fetch(url, {
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
  const wikiSearchUrl = `https://ja.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srlimit=1&srsearch=${encodeURIComponent(query)}`;
  const duckUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;

  const [wikiResult, duckResult] = await Promise.allSettled([
    fetchJson(wikiSearchUrl),
    fetchJson(duckUrl),
  ]);

  const references = [];

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
      const references = await referenceSearch(query);
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
