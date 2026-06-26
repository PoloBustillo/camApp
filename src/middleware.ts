import { auth } from "@/auth";
import { NextResponse } from "next/server";

const TV_PATTERNS = [
  /SmartTV/i, /Smart_TV/i, /Tizen/i, /WebOs/i,
  /Web0S/i, /webOS/i, /WebOS/i, /Hisense/i,
  /VIDAA/i, /Viera/i, /NetCast/i, /Roku\/DVP/i,
  /AppleTV/i, /CrKey/i, /Android TV/i, /GoogleTV/i,
  /AFTS/i, /BRAVIA/i, /SonyCEBrowser/i, /PhilipsTv/i,
  /Opera TV/i, /Vewd/i, /HbbTV/i, /playstation/i,
  /nintendo/i, /xbox/i, /SMART-TV/i,
];

function isTvBrowser(ua: string): boolean {
  if (!ua) return false;
  return TV_PATTERNS.some((pattern) => pattern.test(ua));
}

export default auth((req) => {
  const { nextUrl } = req;
  const isAuthenticated = !!req.auth?.user;
  const userAgent = req.headers.get("user-agent") ?? "";

  const isPublicAuthApi = nextUrl.pathname.startsWith("/api/auth");
  const isApiRoute = nextUrl.pathname.startsWith("/api");
  const isLoginPage = nextUrl.pathname === "/login";

  if (isPublicAuthApi) return NextResponse.next();

  // TV browser detection: redirect authenticated users to /tv immediately
  if (
    isAuthenticated &&
    !nextUrl.pathname.startsWith("/tv") &&
    isTvBrowser(userAgent)
  ) {
    return NextResponse.redirect(new URL("/tv", nextUrl));
  }

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
