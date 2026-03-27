import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseClient';

/**
 * PATCH /api/reports/update
 *
 * Update the ai_insights JSONB on an existing report.
 * Used by the report edit flow to save agent edits.
 *
 * Body: { reportId: string, ai_insights: object }
 */
export async function PATCH(req: NextRequest) {
    try {
        const body = await req.json();
        const { reportId, ai_insights } = body;

        if (!reportId || !ai_insights) {
            return NextResponse.json(
                { error: 'reportId and ai_insights are required' },
                { status: 400 }
            );
        }

        const supabase = getSupabaseAdmin();

        const { data, error } = await supabase
            .from('policy_reports')
            .update({
                ai_insights,
                updated_at: new Date().toISOString(),
            })
            .eq('id', reportId)
            .select()
            .single();

        if (error) {
            console.error('Failed to update report:', error);
            return NextResponse.json({ error: 'Failed to update report' }, { status: 500 });
        }

        return NextResponse.json({ success: true, report: data });
    } catch (err: any) {
        console.error('Error updating report:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
