import { readFileSync } from "node:fs";
import { createServer } from "node:http";

const serviceHosts = new Set(["domain-redirects-v2.app.mintapis.com", "domain-redirects-v2b.app.mintapis.com"]);
const config = JSON.parse(readFileSync(new URL("./domains.json", import.meta.url), "utf8"));
const routes = new Map();
const hostnamePattern = /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/;

for (const [domain, { to, root, hosts }] of Object.entries(config)) {
  if (!hostnamePattern.test(domain) || !/^https:\/\/[a-z0-9.-]+$/.test(to) || typeof root !== "string" || !root.startsWith("/")) {
    throw new Error(`Invalid redirect configuration for ${domain}`);
  }
  for (const host of hosts ?? [domain, `www.${domain}`]) {
    if (!hostnamePattern.test(host) || (host !== domain && host !== `www.${domain}`)) throw new Error(`Invalid hostname ${host}`);
    if (routes.has(host)) throw new Error(`Duplicate redirect hostname ${host}`);
    routes.set(host, { domain, to, root });
  }
}

const server = createServer((request, response) => {
  const host = (request.headers.host ?? "").toLowerCase().replace(/:\d+$/, "");
  const target = request.url ?? "/";

  if ((host === "localhost" || host === "127.0.0.1" || host === "[::1]" || serviceHosts.has(host)) && request.method === "GET" && target === "/healthz") {
    response.writeHead(204, { "Cache-Control": "no-store" });
    return response.end();
  }

  const route = routes.get(host);
  if (!route) {
    response.writeHead(404, { "Content-Length": "0", "Cache-Control": "no-store" });
    return response.end();
  }
  if (!target.startsWith("/") || target.startsWith("//") || target.includes("\r") || target.includes("\n")) {
    response.writeHead(400, { "Content-Length": "0", "Cache-Control": "no-store" });
    return response.end();
  }

  const queryIndex = target.indexOf("?");
  const path = queryIndex >= 0 ? target.slice(0, queryIndex) : target;
  const query = queryIndex >= 0 ? target.slice(queryIndex + 1) : "";
  const finalPath = path === "/" ? route.root : path;
  const params = query ? `${query}&` : "";
  const location = `${route.to}${finalPath}?${params}utm_source=${encodeURIComponent(route.domain)}`;
  response.writeHead(301, { Location: location, "Cache-Control": "public, max-age=3600", "Content-Length": "0" });
  response.end();
});

server.listen(3000, "::");
