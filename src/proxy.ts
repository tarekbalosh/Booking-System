import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE } from "@/lib/constants";

const LOCALES = ["ar", "en"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/ar", request.url));
  }

  const segments = pathname.split("/");
  const locale = segments[1];
  if (!locale || !LOCALES.includes(locale)) {
    return NextResponse.next();
  }

  // Cheap edge gate for the admin area. The real session validation happens
  // server-side in the protected layout and in every server action.
  const isAdmin = segments[2] === "admin";
  const isLogin = segments[3] === "login";
  if (isAdmin && !isLogin) {
    const session = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    if (!session) {
      const loginUrl = new URL(`/${locale}/admin/login`, request.url);
      loginUrl.searchParams.set("next", `${pathname}${search}`);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};
