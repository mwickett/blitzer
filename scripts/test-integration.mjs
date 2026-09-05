import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Always create our own disposable database. Never accept DATABASE_URL from a
// developer's .env: migrations and test fixtures must not touch a shared DB.
const cwd = fileURLToPath(new URL("..", import.meta.url));
const container = `blitzer-test-${randomUUID()}`;
const password = randomUUID();

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: "inherit",
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} failed with exit code ${result.status}`);
  }
  return result.stdout?.trim();
}

function cleanup() {
  spawnSync("docker", ["rm", "--force", container], { stdio: "ignore" });
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    cleanup();
    process.exit(signal === "SIGINT" ? 130 : 143);
  });
}

try {
  run("docker", [
    "run", "--detach", "--rm", "--name", container,
    "--publish", "127.0.0.1::5432",
    "--env", "POSTGRES_USER=blitzer_test",
    "--env", `POSTGRES_PASSWORD=${password}`,
    "--env", "POSTGRES_DB=blitzer_test",
    "--health-cmd", "pg_isready -U blitzer_test -d blitzer_test",
    "--health-interval", "1s", "--health-timeout", "3s",
    "--health-retries", "30", "postgres:17-alpine",
  ], { stdio: "pipe" });

  for (let attempts = 0; ; attempts++) {
    const status = run("docker", ["inspect", "--format", "{{.State.Health.Status}}", container], { stdio: "pipe" });
    if (status === "healthy") break;
    if (status === "unhealthy" || attempts >= 30) {
      throw new Error("Disposable PostgreSQL failed to become healthy");
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  const address = run("docker", ["port", container, "5432/tcp"], { stdio: "pipe" });
  if (!/^127\.0\.0\.1:\d+$/.test(address)) throw new Error("Expected a loopback database port");
  const env = {
    ...process.env,
    DATABASE_URL: `postgresql://blitzer_test:${password}@${address}/blitzer_test`,
    BLITZER_INTEGRATION_TEST: "1",
  };
  run("npx", ["prisma", "migrate", "deploy"], { env });
  const files = readdirSync(new URL("../tests/integration/", import.meta.url))
    .filter((file) => file.endsWith(".test.ts"))
    .sort()
    .map((file) => `tests/integration/${file}`);
  if (!files.length) throw new Error("No integration tests found");
  run(process.execPath, ["--import", "tsx", "--test", ...files], { env });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  cleanup();
}
