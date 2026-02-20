import { CFPForm } from '@/components/forms/CFPForm';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export default function SubmitPage() {
    return (
        <main className="min-h-screen p-6 md:p-12 relative overflow-hidden">
            {/* Background decorations */}
            <div style={{
                position: 'absolute',
                top: '-10%',
                right: '-10%',
                width: '500px',
                height: '500px',
                background: 'radial-gradient(circle, rgba(6,182,212,0.1) 0%, rgba(0,0,0,0) 70%)',
                borderRadius: '50%',
                pointerEvents: 'none',
                zIndex: -1
            }} />

            <div className="max-w-[700px] mx-auto">
                <div className="flex mb-8">
                    <Link href="/" className="inline-flex items-center text-slate-400 hover:text-slate-200 transition-colors">
                        <ChevronLeft className="w-4 h-4 mr-2" />
                        Back to Home
                    </Link>
                </div>

                <div className="mb-10 text-center">
                    <h1 className="text-3xl font-bold text-white mb-2">Submit a Declaration</h1>
                    <p className="text-slate-400">Fill out the form below to submit your project for funding.</p>
                </div>

                <CFPForm />
            </div>
        </main>
    );
}
