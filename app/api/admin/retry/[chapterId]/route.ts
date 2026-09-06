import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(
  req: NextRequest,
  { params }: { params: { chapterId: string } }
) {
  const chapterId = params.chapterId;
  const supabase = createAdminClient();

  if (!supabase) {
    return NextResponse.json({ success: true, message: 'Retried chapter in mock state' });
  }

  const { data, error } = await supabase
    .from('chapters')
    .update({ status: 'pending' })
    .eq('id', chapterId)
    .select();

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}
