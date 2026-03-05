"use client";

import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { fetchRecentSubmissions, SubmissionDebugRow } from "@/lib/api";
import { FileText, AlertCircle, CheckCircle, Clock } from "lucide-react";
import clsx from "clsx";

/**
 * Minimal admin debug UI to view recent document ingestion pipeline results.
 */
export default function SubmissionsDebug() {
    const [submissions, setSubmissions] = useState<SubmissionDebugRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedJson, setSelectedJson] = useState<string | null>(null);

    useEffect(() => {
        async function loadData() {
            try {
                setLoading(true);
                const data = await fetchRecentSubmissions(20);
                setSubmissions(data);
            } catch (err: any) {
                setError(err.message || "Failed to load submissions");
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, []);

    const renderStatusIcon = (status: string) => {
        switch (status) {
            case "parsed":
            case "done":
                return <CheckCircle className="w-4 h-4 text-green-500" />;
            case "failed":
                return <AlertCircle className="w-4 h-4 text-red-500" />;
            case "processing":
            case "queued":
                return <Clock className="w-4 h-4 text-yellow-500" />;
            default:
                return <FileText className="w-4 h-4 text-[var(--color-primary-light)]" />;
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <div className="w-8 h-8 rounded-full border-2 border-[var(--color-primary)] border-t-transparent animate-spin"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 bg-[var(--color-danger-500)]/10 text-[var(--color-danger-500)] rounded-md">
                <p className="font-semibold">Error Loading Submissions</p>
                <p className="text-sm">{error}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-primary-light)] bg-clip-text text-transparent">
                    Ingestion Flow Debug
                </h1>
                <p className="text-[var(--color-neutral-400)] text-sm">
                    Showing the last 20 API / Worker submissions. Monitor document ingestion, PDF extraction, and missing fields.
                </p>
            </div>

            <div className="overflow-x-auto rounded-xl border border-[var(--color-neutral-800)] bg-[var(--color-neutral-900)]/50 backdrop-blur-sm">
                <table className="w-full text-sm text-left text-[var(--color-neutral-300)]">
                    <thead className="text-xs uppercase bg-[var(--color-neutral-800)]/50 text-[var(--color-neutral-400)]">
                        <tr>
                            <th className="px-5 py-4 font-medium">Time / ID</th>
                            <th className="px-5 py-4 font-medium">Job Status</th>
                            <th className="px-5 py-4 font-medium">Parse Status</th>
                            <th className="px-5 py-4 font-medium">Extracted Name / Policy</th>
                            <th className="px-5 py-4 font-medium">Missing Fields</th>
                            <th className="px-5 py-4 text-right font-medium">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-neutral-800)]">
                        {submissions.map((sub, idx) => (
                            <tr
                                key={sub.id}
                                className="hover:bg-[var(--color-neutral-800)]/30 transition-colors"
                            >
                                <td className="px-5 py-4 align-top">
                                    <div className="font-medium text-[var(--color-neutral-100)]">
                                        {format(new Date(sub.created_at), "MMM d, h:mm a")}
                                    </div>
                                    <div className="text-[11px] text-[var(--color-neutral-500)] font-mono mt-1 break-all max-w-[120px]">
                                        {sub.id.split('-')[0]}...
                                    </div>
                                </td>

                                <td className="px-5 py-4 align-top">
                                    <div className="flex items-center gap-2">
                                        {renderStatusIcon(sub.status)}
                                        <span className="capitalize">{sub.status}</span>
                                    </div>
                                    {sub.error_message && (
                                        <div className="mt-1 text-xs text-red-400 max-w-[200px] line-clamp-2">
                                            {sub.error_message}
                                        </div>
                                    )}
                                </td>

                                <td className="px-5 py-4 align-top">
                                    {sub.dec_page_id ? (
                                        <span className={clsx(
                                            "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                                            sub.parse_status === 'parsed' ? "bg-green-500/10 text-green-400" :
                                                sub.parse_status === 'needs_review' ? "bg-yellow-500/10 text-yellow-400" :
                                                    "bg-[var(--color-neutral-800)] text-[var(--color-neutral-400)]"
                                        )}>
                                            {sub.parse_status || 'Unknown'}
                                        </span>
                                    ) : (
                                        <span className="text-xs text-[var(--color-neutral-500)] italic">—</span>
                                    )}
                                </td>

                                <td className="px-5 py-4 align-top">
                                    {sub.insured_name ? (
                                        <div>
                                            <div className="font-medium text-[var(--color-neutral-200)] truncate max-w-[180px]">
                                                {sub.insured_name}
                                            </div>
                                            <div className="text-xs text-[var(--color-primary-light)] mt-1">
                                                #{sub.policy_number || 'N/A'}
                                            </div>
                                        </div>
                                    ) : (
                                        <span className="text-xs text-[var(--color-neutral-500)] italic">—</span>
                                    )}
                                </td>

                                <td className="px-5 py-4 align-top">
                                    {sub.missing_fields && sub.missing_fields.length > 0 ? (
                                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                                            {sub.missing_fields.map(f => (
                                                <span key={f} className="inline-block px-1.5 py-0.5 bg-red-500/10 text-red-300 text-[10px] rounded whitespace-nowrap">
                                                    {f}
                                                </span>
                                            ))}
                                        </div>
                                    ) : sub.parse_status === 'parsed' ? (
                                        <span className="text-xs text-green-500/70">None</span>
                                    ) : (
                                        <span className="text-xs text-[var(--color-neutral-500)] italic">—</span>
                                    )}
                                </td>

                                <td className="px-5 py-4 align-top text-right">
                                    {sub.extracted_json && (
                                        <button
                                            onClick={() => setSelectedJson(JSON.stringify(sub.extracted_json, null, 2))}
                                            className="text-xs font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-light)] transition-colors"
                                        >
                                            View JSON
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}

                        {submissions.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-5 py-12 text-center text-[var(--color-neutral-500)] text-sm">
                                    No submissions found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {selectedJson && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="w-full max-w-2xl max-h-[80vh] flex flex-col bg-[var(--color-background-elevated)] border border-[var(--color-neutral-800)] shadow-2xl rounded-xl overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-neutral-800)] bg-[var(--color-neutral-900)]">
                            <h3 className="font-medium text-[var(--color-neutral-100)] flex items-center gap-2">
                                <FileText className="w-4 h-4 text-[var(--color-primary)]" />
                                Raw Parsed JSON
                            </h3>
                            <button
                                onClick={() => setSelectedJson(null)}
                                className="text-[var(--color-neutral-400)] hover:text-[var(--color-neutral-200)] transition-colors p-1"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto p-4 bg-[var(--color-background)]">
                            <pre className="text-xs font-mono text-green-400 whitespace-pre-wrap break-all">
                                {selectedJson}
                            </pre>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
