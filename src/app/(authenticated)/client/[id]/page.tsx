import { ClientInfo } from '@/components/client/ClientInfo';
import { ClientPolicyList } from '@/components/client/ClientPolicyList';
import { ActivityTimeline } from '@/components/shared/ActivityTimeline';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function ClientPage({ params }: PageProps) {
    const { id } = await params;

    return (
        <main className="min-h-screen bg-gray-50 p-8">
            <ClientInfo clientId={id} />
            <ClientPolicyList clientId={id} />
            <ActivityTimeline clientId={id} />
        </main>
    );
}
