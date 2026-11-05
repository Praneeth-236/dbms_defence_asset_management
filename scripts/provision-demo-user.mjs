import { randomBytes, pbkdf2 } from "node:crypto";
import { resolve } from "node:path";
import { createInterface } from "node:readline";
import nextEnv from "@next/env";
import mysql from "mysql2/promise";

const ITERATIONS = 310000;
const KEY_LENGTH = 32;
const EXPECTED_DATABASE = "defence_asset_system";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(resolve(process.cwd()));

function ask(question, hidden = false) {
  return new Promise((resolve) => {
    const input = process.stdin;
    const output = process.stdout;
    const readline = createInterface({ input, output });
    if (!hidden || !input.isTTY) {
      readline.question(question, (answer) => {
        readline.close();
        resolve(answer.trim());
      });
      return;
    }

    output.write(question);
    input.setRawMode(true);
    input.resume();
    let answer = "";
    const onData = (chunk) => {
      const character = chunk.toString("utf8");
      if (character === "\u0003") {
        input.setRawMode(false);
        input.removeListener("data", onData);
        readline.close();
        process.exit(130);
      }
      if (character === "\r" || character === "\n") {
        input.setRawMode(false);
        input.removeListener("data", onData);
        output.write("\n");
        readline.close();
        resolve(answer);
      } else if (character === "\u007f") {
        answer = answer.slice(0, -1);
      } else {
        answer += character;
      }
    };
    input.on("data", onData);
  });
}

function hashPassword(password, salt) {
  return new Promise((resolve, reject) => {
    pbkdf2(password, salt, ITERATIONS, KEY_LENGTH, "sha256", (error, digest) => {
      if (error) reject(error);
      else resolve(`pbkdf2-sha256$${ITERATIONS}$${salt.toString("base64url")}$${digest.toString("base64url")}`);
    });
  });
}

function requiredDatabaseEnvironment() {
  const names = ["DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD"];
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length) throw new Error(`Missing database environment: ${missing.join(", ")}`);
  if (process.env.DB_NAME !== EXPECTED_DATABASE) {
    throw new Error(`Refusing to provision: DB_NAME must be ${EXPECTED_DATABASE}.`);
  }
  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 3306),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
  };
}

const database = requiredDatabaseEnvironment();
console.log(`Target database: ${database.database} at ${database.host}:${database.port}`);

const connection = await mysql.createConnection(database);
try {
  const [databaseRows] = await connection.query("SELECT DATABASE() AS selectedDatabase");
  const selectedDatabase = Array.isArray(databaseRows)
    ? databaseRows[0]?.selectedDatabase
    : undefined;
  if (selectedDatabase !== EXPECTED_DATABASE) {
    throw new Error(`Refusing to provision: connected database is not ${EXPECTED_DATABASE}.`);
  }
  console.log(`Connected database verified: ${EXPECTED_DATABASE}`);

const role = await ask("Role (Admin or Analyst): ");
if (role !== "Admin" && role !== "Analyst") throw new Error("Role must be Admin or Analyst.");

const userId = Number(await ask("Numeric UserID: "));
const userName = await ask("Username: ");
const fullName = await ask("Full name (optional): ");
const password = await ask("Password (input is hidden): ", true);

if (!Number.isInteger(userId) || userId <= 0) throw new Error("UserID must be a positive integer.");
if (!/^[\w.-]{1,50}$/.test(userName)) throw new Error("Username must be 1-50 letters, numbers, dot, dash, or underscore.");
if (password.length < 12 || password.length > 200) throw new Error("Password must be 12-200 characters.");

  const [existing] = await connection.execute(
    "SELECT UserID, UserName FROM `USER` WHERE UserID = ? OR UserName = ? LIMIT 1",
    [userId, userName]
  );
  if (Array.isArray(existing) && existing.length > 0) {
    throw new Error("That UserID or username already exists; no changes were made.");
  }

  const confirmation = await ask(`Type CREATE ${userName} to confirm the one-time insert: `);
  if (confirmation !== `CREATE ${userName}`) {
    console.log("Confirmation did not match; no changes were made.");
    process.exitCode = 1;
  } else {
    const salt = randomBytes(16);
    const passwordHash = await hashPassword(password, salt);
    await connection.execute(
      "INSERT INTO `USER` (UserID, UserName, PasswordHash, FullName, Role) VALUES (?, ?, ?, ?, ?)",
      [userId, userName, passwordHash, fullName || null, role]
    );
    console.log("Demo user created. The password and hash were not displayed.");
  }
} finally {
  await connection.end();
}
