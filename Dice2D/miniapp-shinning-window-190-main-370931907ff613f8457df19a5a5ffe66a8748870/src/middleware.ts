import { NextResponse, NextRequest } from "next/server";

export default async function middleware(request: NextRequest) {
  const isApiRoute = request.nextUrl.pathname.startsWith("/api/");
  const requestId = crypto.randomUUID();

  // Skip logging for logger endpoint and static assets to prevent circular requests
  const shouldLog = !request.nextUrl.pathname.startsWith("/api/logger") &&
    !request.nextUrl.pathname.startsWith("/_next/");

  if (shouldLog) {
    try {
      // Attempt to log request asynchronously without blocking
      const url = new URL("/api/logger", request.url);
      fetch(url.toString(), {
        method: "POST",
        body: JSON.stringify({
          level: "info",
          requestId,
          request: {
            url: request.url,
            method: request.method,
            path: request.nextUrl.pathname,
          },
        }),
      }).catch((error) => {
        console.error("Error logging request:", error);
      });
    } catch (error) {
      console.error("Error logging request:", error);
    }
  }

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
  matcher: ["/((?!_next/image|_next/static|api/logger|favicon.ico).*)"],
};
