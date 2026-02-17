import { ClientInfo } from '@/components/client/ClientInfo';
import { ClientPolicyList } from '@/components/client/ClientPolicyList';

interface PageProps {
    params: { id: string };
}

export default async function ClientPage({ params }: PageProps) {
    const { id } = params;

    return (
        <main className="min-h-screen bg-gray-50 p-8">
            <ClientInfo clientId={id} />
            <ClientPolicyList clientId={id} />
        </main>
    );
}
