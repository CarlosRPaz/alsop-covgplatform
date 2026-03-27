import { NextResponse } from 'next/server';
import { getEmailSystemStatus } from '@/lib/emailService';
import { getAllTemplates } from '@/lib/emailTemplates';

/**
 * GET /api/email/status
 *
 * Returns the current email system status including:
 * - send mode (disabled / redirect / live)
 * - redirect target if applicable
 * - whether Postmark is configured
 * - available templates
 */
export async function GET() {
    const status = getEmailSystemStatus();
    const templates = getAllTemplates().map(t => ({
        id: t.id,
        name: t.name,
        description: t.description,
        variables: t.variables,
    }));

    return NextResponse.json({
        ...status,
        templates,
    });
}
