import { NextResponse } from 'next/server';
import { DuplicateEngine } from '@/lib/duplicateEngine';

export async function GET() {
    try {
        const [clients, policies] = await Promise.all([
            DuplicateEngine.findClientDuplicates(),
            DuplicateEngine.findPolicyDuplicates()
        ]);

        return NextResponse.json({
            success: true,
            clients,
            policies,
            count: clients.length + policies.length
        });
    } catch (error: any) {
        console.error("Duplicate Engine API Error:", error);
        return NextResponse.json({ error: error.message || "Failed to find duplicates" }, { status: 500 });
    }
}
