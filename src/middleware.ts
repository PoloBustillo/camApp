import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { nextUrl } = req;
  const isAuthenticated = !!req.auth?.user;

  const isPublicAuthApi = nextUrl.pathname.startsWith("/api/auth");
  const isApiRoute = nextUrl.pathname.startsWith("/api");
  const isLoginPage = nextUrl.pathname === "/login";

  if (isPublicAuthApi) return NextResponse.next();

  if (isApiRoute && !isAuthenticated) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "No autorizado" } },
      { status: 401 },
    );
  }

  if (isLoginPage && isAuthenticated) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }

  if (!isLoginPage && !isApiRoute && !isAuthenticated) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon-192.png|icon-512.png|icon.svg).*)",
  ],
};
