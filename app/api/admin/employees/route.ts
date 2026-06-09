import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSBAdmin } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, '');
}

export async function POST(req: NextRequest) {
  try {
    // Verify the requester is an admin
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: employee } = await supabase
      .from('employees')
      .select('role')
      .eq('auth_user_id', user.id)
      .single();

    if (employee?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { full_name, phone, password, branch_id, role } = await req.json();

    if (!full_name || !phone || !password || !branch_id) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    // Use service role to create user
    const adminClient = createSBAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const email = digitsOnly(phone) + '@tipx.app';

    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    const { error: empError } = await adminClient.from('employees').insert({
      auth_user_id: authData.user.id,
      full_name,
      phone,
      branch_id,
      role: role || 'employee',
    });

    if (empError) {
      // Rollback auth user
      await adminClient.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json({ error: empError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}