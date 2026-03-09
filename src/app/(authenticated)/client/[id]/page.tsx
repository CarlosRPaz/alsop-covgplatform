import { ClientInfo } from '@/components/client/ClientInfo';
import { ClientPolicyList } from '@/components/client/ClientPolicyList';
import { ActivityTimeline } from '@/components/shared/ActivityTimeline';
import { NotesPanel } from '@/components/shared/NotesPanel';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function ClientPage({ params }: PageProps) {
    const { id } = await params;

    return (
        <main className="min-h-screen bg-gray-50 p-8">
            <ClientInfo clientId={id} />
            <ClientPolicyList clientId={id} />

            {/* Notes Section */}
            <div style={{
                background: 'var(--bg-surface)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-default)',
                padding: '1.25rem',
                marginTop: '1.5rem',
            }}>
                <h3 style={{
                    fontSize: '1rem',
                    fontWeight: 600,
                    color: '#e5e7eb',
                    marginBottom: '1rem',
                    paddingBottom: '0.5rem',
                    borderBottom: '1px solid #374151',
                }}>Notes</h3>
                <NotesPanel clientId={id} />
            </div>

            {/* Activity Timeline */}
            <ActivityTimeline clientId={id} />
        </main>
    );
}
