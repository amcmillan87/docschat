import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSession, hashPassword } from '@/lib/auth';

export async function GET() {
  const userId = await getSession();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: users } = await supabase
    .from('users')
    .select('id, email, created_at')
    .order('created_at', { ascending: true });

  return NextResponse.json(users ?? []);
}

export async function POST(request: NextRequest) {
  const userId = await getSession();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { email, password } = await request.json();

  if (!email || !password || password.length < 8) {
    return NextResponse.json(
      { error: 'Email and password (min 8 characters) required' },
      { status: 400 }
    );
  }

  const passwordHash = await hashPassword(password);

  const { data: newUser, error } = await supabase
    .from('users')
    .insert({ email: email.toLowerCase(), password_hash: passwordHash, created_by: userId })
    .select('id, email, created_at')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'An account with that email already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create admin' }, { status: 500 });
  }

  return NextResponse.json(newUser);
}
