import { Sidebar } from "@/components/layout/Sidebar";
import { Footer } from "@/components/layout/Footer";

export default function AuthenticatedLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <div style={{ display: 'flex', flex: 1 }}>
                <Sidebar />
                <div style={{
                    flex: 1,
                    marginLeft: '250px',
                    minWidth: 0,
                    overflowX: 'hidden',
                    backgroundColor: 'var(--background)',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <div style={{ flex: 1, padding: '2rem' }}>
                        {children}
                    </div>
                    <Footer />
                </div>
            </div>
        </div>
    );
}
