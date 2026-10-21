import { NextResponse } from "next/server";
import { auth } from "@/auth";

const PRIVATE_PREFIXES = [
  "/dashboard",
  "/formularios",
  "/candidatos",
  "/clima",
  "/competencias",
  "/areas",
  "/seguimiento",
];

export const proxy = auth((request) => {
  const loggedIn = Boolean(request.auth?.user);
  const { pathname } = request.nextUrl;
  const isPrivate = PRIVATE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (isPrivate && !loggedIn) {
    const url = new URL("/login", request.nextUrl.origin);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  if (loggedIn && (pathname === "/login" || pathname === "/setup")) {
    return NextResponse.redirect(new URL("/dashboard", request.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/formularios/:path*",
    "/candidatos/:path*",
    "/clima/:path*",
    "/competencias/:path*",
    "/areas/:path*",
    "/seguimiento/:path*",
    "/login",
    "/setup",
  ],
};
