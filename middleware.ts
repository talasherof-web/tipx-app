import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> };

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
            supabaseResponse.cookies.set(name, value, options as Parameters<typeof supabaseResponse.cookies.set>[2])
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // Not logged in -> login
  if (!user && path !== '/login') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (user) {
    // Check if login page
    if (path === '/login') {
      // Get role and redirect accordingly
      const { data: employee } = await supabase
        .from('employees')
        .select('role, is_active')
        .eq('auth_user_id', user.id)
        .single();

      if (!employee || !employee.is_active) {
        await supabase.auth.signOut();
        return NextResponse.redirect(new URL('/login', request.url));
      }

      if (employee.role === 'admin') {
        return NextResponse.redirect(new URL('/admin/dashboard', request.url));
      } else {
        return NextResponse.redirect(new URL('/employee/dashboard', request.url));
      }
    }

    // Check employee access
    if (path.startsWith('/admin')) {
      const { data: employee } = await supabase
        .from('employees')
        .select('role, is_active')
        .eq('auth_user_id', user.id)
        .single();

      if (!employee || !employee.is_active) {
        await supabase.auth.signOut();
        return NextResponse.redirect(new URL('/login', request.url));
      }

      if (employee.role !== 'admin') {
        return NextResponse.redirect(new URL('/employee/dashboard', request.url));
      }
    }

    if (path.startsWith('/employee')) {
      const { data: employee } = await supabase
        .from('employees')
        .select('role, is_active')
        .eq('auth_user_id', user.id)
        .single();

      if (!employee || !employee.is_active) {
        await supabase.auth.signOut();
        return NextResponse.redirect(new URL('/login', request.url));
      }
    }

    // Root redirect
    if (path === '/') {
      const { data: employee } = await supabase
        .from('employees')
        .select('role')
        .eq('auth_user_id', user.id)
        .single();

      if (employee?.role === 'admin') {
        return NextResponse.redirect(new URL('/admin/dashboard', request.url));
      } else {
        return NextResponse.redirect(new URL('/employee/dashboard', request.url));
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon-192.png|icon-512.png|manifest.json|sw.js|workbox-.*).*)'],
};
