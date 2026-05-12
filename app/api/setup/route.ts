import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { hashPassword, createSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const { count } = await supabase
    .from('users')
    .select('id', { count: 'exact', head: true });

  if (count && count > 0) {
    return NextResponse.json({ error: 'Setup already complete' }, { status: 403 });
  }

  const { email, password } = await request.json();

  if (!email || !password || password.length < 8) {
    return NextResponse.json(
      { error: 'Email and password (min 8 characters) required' },
      { status: 400 }
    );
  }

  const passwordHash = await hashPassword(password);

  const { data: user, error } = await supabase
    .from('users')
    .insert({ email: email.toLowerCase(), password_hash: passwordHash })
    .select('id')
    .single();

  if (error || !user) {
    return NextResponse.json({ error: 'Setup failed' }, { status: 500 });
  }

  const token = await createSession(user.id);

  const response = NextResponse.json({ ok: true });
  response.cookies.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60,
    path: '/',
  });

  return response;
}
