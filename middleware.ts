// Password protection for the whole app (HTTP Basic auth — the browser shows a login box).
// Hosted (NODE_ENV=production): APP_PASSWORD is required, otherwise the app refuses to serve.
// Local dev: if APP_PASSWORD is empty, no login is asked.
import { NextResponse, type NextRequest } from "next/server";

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function middleware(req: NextRequest) {
  const user = process.env.APP_USERNAME || "admin";
  const pass = process.env.APP_PASSWORD;

  if (!pass) {
    if (process.env.NODE_ENV === "production") {
      return new NextResponse("APP_PASSWORD is not set — refusing to serve without a login.", { status: 503 });
    }
    return NextResponse.next();
  }

  const header = req.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    try {
      const decoded = atob(header.slice(6));
      const i = decoded.indexOf(":");
      if (i > 0 && safeEqual(decoded.slice(0, i), user) && safeEqual(decoded.slice(i + 1), pass)) {
        return NextResponse.next();
      }
    } catch {
      /* malformed header → fall through to 401 */
    }
  }
  return new NextResponse("Login required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="CardOps", charset="UTF-8"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
