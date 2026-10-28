// Garde de navigation : sans session NextAuth, toute page renvoie vers /connexion ;
// avec une session, les pages d'auth renvoient vers l'accueil. Les routes /api se protègent elles-mêmes (Bearer).
import { NextResponse } from "next/server";
import { auth } from "@/auth";

const AUTH_PAGES = ["/connexion", "/inscription"];

export default auth((request) => {
  const onAuthPage = AUTH_PAGES.includes(request.nextUrl.pathname);
  if (!request.auth && !onAuthPage) return NextResponse.redirect(new URL("/connexion", request.nextUrl));
  if (request.auth && onAuthPage) return NextResponse.redirect(new URL("/", request.nextUrl));
  return NextResponse.next();
});

// Les fichiers statiques sont listés par extension : un simple point ne suffit pas (/u/lina.m est une page).
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\.(?:ico|png|jpe?g|gif|svg|webp|avif|txt|xml|webmanifest)$).*)"],
};
