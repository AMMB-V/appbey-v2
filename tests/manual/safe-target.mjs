import { randomInt } from "node:crypto";
import { isIP } from "node:net";

function isLoopbackHost(hostname) {
  const host = hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;
  return host === "localhost" || host === "::1" ||
    (isIP(host) === 4 && host.startsWith("127."));
}

export function parseManualApiTarget(args = process.argv.slice(2), env = process.env) {
  const remoteFlagCount = args.filter((argument) => argument === "--allow-remote").length;
  if (remoteFlagCount > 1) throw new Error("Invalid manual test arguments.");
  const urlArguments = args.filter((argument) => argument !== "--allow-remote");
  if (urlArguments.length > 1 || urlArguments.some((argument) => argument.startsWith("--"))) {
    throw new Error("Invalid manual test arguments.");
  }

  const rawBaseUrl = urlArguments[0] || "http://localhost:3999/api";
  let target;
  try {
    target = new URL(rawBaseUrl);
  } catch {
    throw new Error("Invalid manual test target URL.");
  }
  if (!["http:", "https:"].includes(target.protocol) || target.username || target.password || target.search || target.hash) {
    throw new Error("Invalid manual test target URL.");
  }

  let path = target.pathname;
  while (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  if (path !== "/api" && path !== "/api/v1") throw new Error("Target URL must end in /api or /api/v1.");

  if (!isLoopbackHost(target.hostname)) {
    const allowedHosts = (env.APPBEY_TEST_ALLOWED_HOSTS || "")
      .split(",")
      .map((hostname) => hostname.trim().toLowerCase())
      .filter(Boolean);
    if (
      !args.includes("--allow-remote") ||
      target.protocol !== "https:" ||
      target.port !== "" ||
      !allowedHosts.includes(target.hostname.toLowerCase())
    ) {
      throw new Error("Remote tests require --allow-remote and a host listed in APPBEY_TEST_ALLOWED_HOSTS.");
    }
  }

  return {
    baseUrl: `${target.origin}${path}`,
    healthUrl: `${target.origin}/healthz`
  };
}

const API_BASE_PATHS = new Map([["/api", "/api"], ["/api/v1", "/api/v1"]]);
const API_SEGMENTS = new Map([
  "auth", "login", "register", "tournaments", "matches", "users", "participants",
  "checkin", "start", "referee", "groups", "queue", "generate-playoffs",
  "next-round", "manual-score", "record-finish", "reopen", "undo-finish", "declare-winner"
].map((segment) => [segment, segment]));

function mapApiSegment(segment) {
  if (/^\d{1,15}$/.test(segment)) return String(Number.parseInt(segment, 10));
  const known = API_SEGMENTS.get(segment);
  if (known === undefined) throw new Error("Invalid manual API endpoint.");
  return known;
}

export function buildManualApiUrl(baseUrl, endpoint) {
  const [path, query, ...extraQueryParts] = endpoint.split("?");
  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    !/^\/[A-Za-z0-9_/-]+$/.test(path) ||
    path.split("/").some((segment) => segment === "." || segment === "..") ||
    extraQueryParts.length > 0 ||
    (query !== undefined && !/^[A-Za-z0-9_=&-]*$/.test(query))
  ) {
    throw new Error("Invalid manual API endpoint.");
  }

  const base = new URL(baseUrl);
  const basePath = API_BASE_PATHS.get(base.pathname);
  if (basePath === undefined) throw new Error("Invalid manual API endpoint.");
  const segments = path.slice(1).split("/").map(mapApiSegment);
  const target = new URL(`${basePath}/${segments.join("/")}`, base.origin);
  if (query) {
    for (const [key, value] of new URLSearchParams(query)) target.searchParams.append(key, value);
  }
  return target.href;
}
export async function resolveManualApiTarget(args = process.argv.slice(2), env = process.env, fetchImpl = fetch) {
  const target = parseManualApiTarget(args, env);
  let response;
  try {
    response = await fetchImpl(target.healthUrl, {
      redirect: "error",
      signal: AbortSignal.timeout(5000)
    });
  } catch {
    throw new Error("Target health check failed.");
  }
  if (!response.ok) throw new Error("Target health check failed.");

  let health;
  try {
    health = await response.json();
  } catch {
    throw new Error("Target health check returned an invalid response.");
  }
  if (health?.storage !== "in-memory") {
    throw new Error("Manual simulations require an in-memory server to avoid persistent data changes.");
  }
  return target;
}

export function createManualApiClient(baseUrl) {
  return async function req(method, url, body, token) {
    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(buildManualApiUrl(baseUrl, url), {
      method,
      headers,
      redirect: "error",
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    let json = null;
    try { json = await res.json(); } catch { /* no body */ }
    return { status: res.status, body: json };
  };
}

function sanitizeLog(value) {
  return String(value).replace(/[\r\n\u2028\u2029]+/g, " ");
}

export function createChecks() {
  const checks = {
    failures: 0,
    assert(condition, message) {
      if (!condition) {
        checks.failures++;
        console.error(`FAIL: ${sanitizeLog(message)}`);
      } else {
        console.log(`ok: ${sanitizeLog(message)}`);
      }
    }
  };
  return checks;
}

export function createRegisterAndLogin(req) {
  return async function registerAndLogin(username) {
    await req("POST", "/auth/register", {
      username,
      email: `${username}@sim.test`,
      password: "PlayerPass123!",
      display_name: username
    });
    const login = await req("POST", "/auth/login", { email: `${username}@sim.test`, password: "PlayerPass123!" });
    return { username, token: login.body?.access_token, id: login.body?.user?.id };
  };
}
export function randomBelow(max) {
  return randomInt(max);
}
