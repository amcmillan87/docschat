import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const userId = await getSession();
  if (!userId) return NextResponse.json(null);

  const { data: user } = await supabase
    .from('users')
    .select('id, email')
    .eq('id', userId)
    .single();

  return NextResponse.json(user);
}
