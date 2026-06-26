import { createServerClient } from "@supabase/ssr";
import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { neon } from "@neondatabase/serverless";

const PROTECTED = ["/dashboard", "/journal", "/analytics", "/settings", "/onboarding", "/choose-destination"];
const AUTH_ROUTES = ["/login", "/register"];

type CookieToSet = {
  name: string;
  value: string;
  options?: Partial<ResponseCookie>;
};

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session - MUST call getUser() not getSession()
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Admin panel path masking.
  // This runs at request time so ADMIN_PANEL_PATH can rotate without a rebuild.
  const ADMIN_REAL_FOLDER = "/admin-panel";

  if (pathname === ADMIN_REAL_FOLDER || pathname.startsWith(`${ADMIN_REAL_FOLDER}/`)) {
    return NextResponse.rewrite(new URL(`/__tc_admin_404__${pathname}`, request.url));
  }

  const adminSecretPath = process.env.ADMIN_PANEL_PATH;
  const isAdminPathConfigured =
    !!adminSecretPath && adminSecretPath !== "replace-with-a-secret-path-only-you-know";

  if (isAdminPathConfigured) {
    const secretRoot = `/${adminSecretPath}`;
    const exactMatch = pathname === secretRoot;
    const prefixMatch = pathname.startsWith(`${secretRoot}/`);
    const match = exactMatch || prefixMatch;

    if (match) {
      const url = request.nextUrl.clone();
      url.pathname = `${ADMIN_REAL_FOLDER}${pathname.slice(secretRoot.length)}`;
      return NextResponse.rewrite(url);
    }
  }

  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));
  const isAuthRoute = AUTH_ROUTES.some((p) => pathname.startsWith(p));

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  if (user && isProtected) {
    try {
      const sql = neon(process.env.DATABASE_URL!);
      const rows = await sql`
        SELECT deleted_at FROM users WHERE id = ${user.id} LIMIT 1
      `;
      const row = rows[0] as { deleted_at: Date | null } | undefined;
      if (row?.deleted_at != null) {
        await supabase.auth.signOut();
        const url = request.nextUrl.clone();
        url.pathname = "/deactivated";
        const redirect = NextResponse.redirect(url);
        supabaseResponse.cookies.getAll().forEach((c) => {
          redirect.cookies.set(c.name, c.value, { path: "/" });
        });
        return redirect;
      }
    } catch (err) {
      console.error("[middleware] soft-delete DB check failed:", err);
    }
  }

  if (user && isProtected && pathname !== "/onboarding") {
    const onboardingDone = user.user_metadata?.onboarding_complete === true;
    if (!onboardingDone) {
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|icons|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
