import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Dedicated read-only Prisma client using a read-only connection string when available.
// Falls back to the primary URL to avoid breaking local dev, but all tools still enforce
// read-only operations at the application level.

const prismaReadonlyClientSingleton = () => {
  const url = process.env.DATABASE_URL_READONLY ?? process.env.DATABASE_URL;
  const adapter = new PrismaPg({
    connectionString: url!,
  });
  return new PrismaClient({ adapter });
};

declare const globalThis: {
  prismaReadonlyGlobal: ReturnType<typeof prismaReadonlyClientSingleton>;
} & typeof global;

const prismaReadonly =
  globalThis.prismaReadonlyGlobal ?? prismaReadonlyClientSingleton();

export default prismaReadonly;

if (process.env.NODE_ENV !== "production")
  globalThis.prismaReadonlyGlobal = prismaReadonly;
