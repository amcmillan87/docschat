import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';
import { supabase } from './supabase';

export async function getSession(): Promise<string | null> {
  const cookieStore = cookies();
  const token = cookieStore.get('session')?.value;
  if (!token) return null;

  const { data } = await supabase
    .from('sessions')
    .select('user_id, expires_at')
    .eq('token', token)
    .single();

  if (!data || new Date(data.expires_at) < new Date()) return null;

  return data.user_id as string;
}

export async function createSession(userId: string): Promise<string> {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await supabase.from('sessions').insert({
    user_id: userId,
    token,
    expires_at: expiresAt.toISOString(),
  });

  return token;
}

export async function deleteSession(token: string): Promise<void> {
  await supabase.from('sessions').delete().eq('token', token);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
