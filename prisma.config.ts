import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "src/server/db/schema.prisma",
  migrations: {
    path: "src/server/db/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
