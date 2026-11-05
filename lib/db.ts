import { readFileSync } from "node:fs";
import mysql, { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

let pool: Pool | undefined;
type SqlValue = string | number | boolean | bigint | Date | null;
type DatabaseError = Error & {
  code?: string;
  errno?: number;
  sqlState?: string;
  missing?: string[];
};

function isDatabaseError(error: unknown): error is DatabaseError {
  return error instanceof Error;
}

export function logDatabaseError(context: string, error: unknown): void {
  if (!isDatabaseError(error)) {
    console.error(`[${context}] database operation failed`, { code: "UNKNOWN_ERROR" });
    return;
  }

  const details: Record<string, string | number | string[]> = {
    code: error.code ?? "UNKNOWN_ERROR"
  };

  if (typeof error.errno === "number") details.errno = error.errno;
  if (typeof error.sqlState === "string") details.sqlState = error.sqlState;
  if (Array.isArray(error.missing)) details.missing = error.missing;

  console.error(`[${context}] database operation failed`, details);
}

function getPool(): Pool {
  if (!pool) {
    const required = ["DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD"];
    const missing = required.filter((key) => !process.env[key]);
    if (missing.length > 0) {
      const error = new Error("Database configuration is incomplete") as DatabaseError;
      error.code = "DB_CONFIG_MISSING";
      error.missing = missing;
      throw error;
    }
    if (process.env.NODE_ENV === "production" && process.env.DB_SSL !== "true") {
      const error = new Error("DB_SSL must be enabled in production") as DatabaseError;
      error.code = "DB_TLS_REQUIRED";
      throw error;
    }
    const port = Number(process.env.DB_PORT ?? 3306);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      const error = new Error("DB_PORT must be a valid TCP port") as DatabaseError;
      error.code = "DB_CONFIG_INVALID";
      throw error;
    }
    const ssl = process.env.DB_SSL === "true"
      ? { rejectUnauthorized: true, ...(process.env.DB_SSL_CA ? { ca: readFileSync(process.env.DB_SSL_CA, "utf8") } : {}) }
      : undefined;
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      port,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectionLimit: 5,
      waitForConnections: true,
      queueLimit: 50,
      connectTimeout: 10_000,
      ssl
    });
  }
  return pool;
}

export async function query<T extends RowDataPacket[] = RowDataPacket[]>(
  sql: string,
  values: SqlValue[] = []
): Promise<T> {
  const [rows] = await getPool().execute<T>(sql, values);
  return rows;
}

export async function execute(sql: string, values: SqlValue[] = []): Promise<ResultSetHeader> {
  const [result] = await getPool().execute<ResultSetHeader>(sql, values);
  return result;
}

export async function withTransaction<T>(
  callback: (connection: PoolConnection) => Promise<T>
): Promise<T> {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
