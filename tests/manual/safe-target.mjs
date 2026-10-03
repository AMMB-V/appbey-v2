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
