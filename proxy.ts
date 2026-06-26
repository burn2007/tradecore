import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { neon } from "@neondatabase/serverless";

const PROTECTED = ["/dashboard", "/journal", "/analytics", "/settings", "/onboarding", "/choose-destination"];
const AUTH_ROUTES = ["/login", "/register"];

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session — MUST call getUser() not getSession()
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // ── Admin panel path masking ────────────────────────────────────────────
  // Chose middleware over a next.config.ts rewrite: next.config.ts
  // rewrites are resolved into the build's routes-manifest at BUILD time,
  // so rotating ADMIN_PANEL_PATH later would need a rebuild/redeploy for
  // the new value to take effect. Middleware reads process.env fresh on
  // every request at runtime, so rotating the secret path only needs an
  // env var change (+ process restart) — no redeploy, no code change.
  //
  // The literal real folder name always 404s, unconditionally — this check
  // has nothing to do with auth, it's purely about not confirming the
  // route's existence to anyone probing for it.
  const ADMIN_REAL_FOLDER = "/admin-panel";

  // ── [DIAG] Step 1: incoming request ──────────────────────────────────────
  console.log("[admin-diag] pathname            :", JSON.stringify(pathname));
  console.log("[admin-diag] ADMIN_PANEL_PATH raw:", JSON.stringify(process.env.ADMIN_PANEL_PATH));

  if (pathname === ADMIN_REAL_FOLDER || pathname.startsWith(`${ADMIN_REAL_FOLDER}/`)) {
    console.log("[admin-diag] → hit real-folder block → 404 rewrite");
    return NextResponse.rewrite(new URL(`/__tc_admin_404__${pathname}`, request.url));
  }

  // If ADMIN_PANEL_PATH is unset (or still the .env.example placeholder),
  // fail closed: the admin panel is unreachable by any URL rather than
  // falling back to a guessable default.
  const adminSecretPath = process.env.ADMIN_PANEL_PATH;
  const isAdminPathConfigured =
    !!adminSecretPath && adminSecretPath !== "replace-with-a-secret-path-only-you-know";

  // ── [DIAG] Step 2: is the env var usable? ────────────────────────────────
  console.log("[admin-diag] adminSecretPath     :", JSON.stringify(adminSecretPath));
  console.log("[admin-diag] isAdminPathConfigured:", isAdminPathConfigured);

  if (isAdminPathConfigured) {
    const secretRoot = `/${adminSecretPath}`;
    const exactMatch = pathname === secretRoot;
    const prefixMatch = pathname.startsWith(`${secretRoot}/`);
    const match = exactMatch || prefixMatch;

    // ── [DIAG] Step 3: does pathname hit the secret root? ────────────────
    console.log("[admin-diag] secretRoot          :", JSON.stringify(secretRoot));
    console.log("[admin-diag] pathname===secretRoot:", exactMatch);
    console.log("[admin-diag] startsWith(secretRoot/):", prefixMatch);
    console.log("[admin-diag] overall match       :", match);

    if (match) {
      const url = request.nextUrl.clone();
      url.pathname = `${ADMIN_REAL_FOLDER}${pathname.slice(secretRoot.length)}`;
      console.log("[admin-diag] → rewriting to      :", url.pathname);
      return NextResponse.rewrite(url);
    }
  }

  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));
  const isAuthRoute = AUTH_ROUTES.some((p) => pathname.startsWith(p));

  // Unauthenticated — block protected routes
  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Authenticated — redirect away from auth pages
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // ── Soft-delete gate — most important check ──────────────────────────────
  // A soft-deleted user's Supabase session is still technically valid, so we
  // must explicitly check deleted_at on every protected request and block them.
  // We do this AFTER the unauthenticated redirect so we only hit the DB when
  // there is actually a session. We check on ALL protected routes (not just
  // the onboarding gate) so there is no path through the trader app for a
  // soft-deleted account.
  if (user && isProtected) {
    try {
      const sql = neon(process.env.DATABASE_URL!);
      const rows = await sql`
        SELECT deleted_at FROM users WHERE id = ${user.id} LIMIT 1
      `;
      const row = rows[0] as { deleted_at: Date | null } | undefined;
      if (row?.deleted_at != null) {
        // Sign them out server-side by clearing the Supabase session, then
        // redirect to the deactivated page.
        await supabase.auth.signOut();
        const url = request.nextUrl.clone();
        url.pathname = "/deactivated";
        const redirect = NextResponse.redirect(url);
        // Copy any updated cookies from supabaseResponse (session clear) to
        // the redirect response so the sign-out takes effect.
        supabaseResponse.cookies.getAll().forEach((c) => {
          redirect.cookies.set(c.name, c.value, { path: "/" });
        });
        return redirect;
      }
    } catch (err) {
      // If the DB check fails, fail open (don't lock out users due to a
      // transient DB error) but log loudly so we can investigate.
      console.error("[proxy] soft-delete DB check failed:", err);
    }
  }

  // Authenticated — enforce onboarding gate
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
