import { NextResponse } from "next/server";
import { query } from "../../../../lib/db";
import { createSessionToken, roleAllowed, setSessionCookie, verifyPassword } from "../../../../lib/auth";
import type { RowDataPacket } from "mysql2/promise";

type UserRow = RowDataPacket & {
  UserID: number;
  UserName: string;
  PasswordHash: string;
  Role: string | null;
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const userName = typeof body?.userName === "string" ? body.userName.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!userName || !password || userName.length > 50 || password.length > 200) {
    return NextResponse.json({ error: "Enter a valid username and password." }, { status: 400 });
  }

  try {
    const rows = await query<UserRow[]>(
      "SELECT UserID, UserName, PasswordHash, Role FROM `USER` WHERE UserName = ? LIMIT 1",
      [userName]
    );
    const user = rows[0];
    const role = user?.Role ?? undefined;
    if (!user || !roleAllowed(role) || !(await verifyPassword(password, user.PasswordHash))) {
      return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
    }

    const response = NextResponse.json({ userName: user.UserName, role: user.Role });
    setSessionCookie(response, createSessionToken({ userId: user.UserID, userName: user.UserName, role }));
    return response;
  } catch (error) {
    const code = error instanceof Error && "code" in error && typeof error.code === "string"
      ? error.code
      : "AUTH_DATABASE_ERROR";
    console.error("[auth.login] authentication failed", {
      code
    });
    if (code === "AUTH_SESSION_CONFIG_MISSING") {
      return NextResponse.json({ error: "Authentication is not configured on the server." }, { status: 503 });
    }
    return NextResponse.json({ error: "Authentication is temporarily unavailable." }, { status: 503 });
  }
}
