import { NextResponse } from "next/server";
import { verifyPassword, createSessionToken } from "@/lib/auth";

export async function POST(request: Request) {
  let password: string;
  try {
    const body = await request.json();
    password = body.password;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!password || !verifyPassword(password)) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  const token = createSessionToken();
  const response = NextResponse.json({ success: true });

  response.cookies.set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 24 * 60 * 60, // 24 hours
    path: "/",
  });

  return response;
}
