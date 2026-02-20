import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export default function PublicLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <Navbar />
            <div style={{
                flex: 1,
                backgroundColor: 'var(--background)',
                display: 'flex',
                flexDirection: 'column',
                paddingTop: '60px', /* Account for fixed navbar */
            }}>
                <div style={{ flex: 1, padding: '2rem' }}>
                    {children}
                </div>
                <Footer />
            </div>
        </div>
    );
}
