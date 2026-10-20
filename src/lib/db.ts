import { PrismaClient } from "@prisma/client";

const relationReadOperations = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
]);

function optimizedDatabaseUrl() {
  const configured = process.env.DATABASE_URL;
  if (!configured) return undefined;

  try {
    const url = new URL(configured);
    if (!url.searchParams.has("connection_limit")) {
      url.searchParams.set(
        "connection_limit",
        process.env.DATABASE_CONNECTION_LIMIT ?? "3",
      );
    }
    if (!url.searchParams.has("connect_timeout"))
      url.searchParams.set("connect_timeout", "10");
    if (!url.searchParams.has("pool_timeout"))
      url.searchParams.set("pool_timeout", "20");
    return url.toString();
  } catch {
    // Prisma will provide the normal configuration error for malformed URLs.
    return configured;
  }
}

function createPrismaClient(): PrismaClient {
  const datasourceUrl = optimizedDatabaseUrl();
  const client = new PrismaClient({
    ...(datasourceUrl
      ? { datasources: { db: { url: datasourceUrl } } }
      : {}),
    // Supabase round trips can exceed Prisma's 5-second interactive default.
    transactionOptions: { maxWait: 10000, timeout: 60000 },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ operation, args, query }) {
          if (
            relationReadOperations.has(operation) &&
            args &&
            typeof args === "object" &&
            "include" in args &&
            args.include
          ) {
            return query({
              ...args,
              relationLoadStrategy: "join",
            } as typeof args);
          }
          return query(args);
        },
      },
    },
  }) as unknown as PrismaClient;
}

type AppPrismaClient = ReturnType<typeof createPrismaClient>;
const globalForPrisma = globalThis as unknown as { prisma?: AppPrismaClient };

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
