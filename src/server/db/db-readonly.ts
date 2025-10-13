import { PrismaClient } from "@prisma/client";

// Dedicated read-only Prisma client using a read-only connection string when available.
// Falls back to the primary URL to avoid breaking local dev, but all tools still enforce
// read-only operations at the application level.

const prismaReadonlyClientSingleton = () => {
  const url = process.env.DATABASE_URL_READONLY ?? process.env.DATABASE_URL;
  return new PrismaClient({
    datasources: {
      db: { url },
    },
  });
};

declare const globalThis: {
  prismaReadonlyGlobal: ReturnType<typeof prismaReadonlyClientSingleton>;
} & typeof global;

const prismaReadonly =
  globalThis.prismaReadonlyGlobal ?? prismaReadonlyClientSingleton();

export default prismaReadonly;

if (process.env.NODE_ENV !== "production")
  globalThis.prismaReadonlyGlobal = prismaReadonly;

