import { NextResponse, NextRequest } from "next/server";

export default function middleware(request: NextRequest) {
  const isApiRoute = request.nextUrl.pathname.startsWith("/api/");
  const requestId = crypto.randomUUID();

  const response = NextResponse.next();
  response.headers.set("x-request-id", requestId);

  if (!isApiRoute) {
    response.cookies.set("x-request-id", requestId, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60,
      secure: request.url.startsWith("https"),
    });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/image|_next/static|favicon.ico).*)"],
};
