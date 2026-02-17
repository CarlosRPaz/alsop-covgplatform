'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Card } from '@/components/ui/Card/Card';
import styles from './DataTable.module.scss';
import { clsx } from 'clsx';
import { fetchDeclarations, Declaration } from '@/lib/api';
import { ArrowUpDown, Search, ChevronDown, ChevronUp, Columns } from 'lucide-react';
import { Button } from '@/components/ui/Button/Button';
import { useRouter } from 'next/navigation';

// Column IDs for easy management
const COLUMNS: { key: keyof Declaration; label: string; width?: string }[] = [
    { key: 'policy_number', label: 'Policy #' },
    { key: 'insured_name', label: 'Insured Name' },
    { key: 'property_location', label: 'Property Location', width: '250px' },
    { key: 'total_annual_premium', label: 'Premium' },
    { key: 'renewal_date', label: 'Renewal' },
    { key: 'status', label: 'Status' },
    { key: 'flags', label: 'Flags' },
    { key: 'mailing_address', label: 'Mailing Address' },
    { key: 'broker_name', label: 'Broker' },
    { key: 'limit_dwelling', label: 'Dwelling Limit' },
];

export function DataTable() {
    const router = useRouter();
    const [data, setData] = useState<Declaration[]>([]);
    const [sortConfig, setSortConfig] = useState<{ key: keyof Declaration; direction: 'asc' | 'desc' } | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Column Visibility State
    const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(COLUMNS.map(c => c.key)));
    const [isColumnMenuOpen, setIsColumnMenuOpen] = useState(false);

    // Flag Visibility State
    const [allFlags, setAllFlags] = useState<string[]>([]);
    const [selectedFlags, setSelectedFlags] = useState<Set<string>>(new Set());
    const [isFlagMenuOpen, setIsFlagMenuOpen] = useState(false);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [isRowsPerPageMenuOpen, setIsRowsPerPageMenuOpen] = useState(false);

    useEffect(() => {
        fetchDeclarations().then(fetchedData => {
            setData(fetchedData);
            // Extract unique flags
            const flags = new Set<string>();
            fetchedData.forEach(d => d.flags?.forEach(f => flags.add(f)));
            setAllFlags(Array.from(flags).sort());
        });
    }, []);

    // Reset page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, selectedFlags]);

    const handleSort = (key: keyof Declaration) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const toggleColumn = (key: string) => {
        const newSet = new Set(visibleColumns);
        if (newSet.has(key)) {
            newSet.delete(key);
        } else {
            newSet.add(key);
        }
        setVisibleColumns(newSet);
    };

    const toggleFlag = (flag: string) => {
        const newSet = new Set(selectedFlags);
        if (newSet.has(flag)) {
            newSet.delete(flag);
        } else {
            newSet.add(flag);
        }
        setSelectedFlags(newSet);
    };

    const filteredData = useMemo(() => {
        let result = data;

        // 1. Filter by Search Query
        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            result = result.filter(item => {
                return Object.values(item).some(val =>
                    val && String(val).toLowerCase().includes(lowerQuery)
                );
            });
        }

        // 2. Filter by Selected Flags
        if (selectedFlags.size > 0) {
            result = result.filter(item => {
                if (!item.flags || item.flags.length === 0) return false;
                // Match ANY selected flag
                return item.flags.some(flag => selectedFlags.has(flag));
            });
        }

        return result;
    }, [data, searchQuery, selectedFlags]);

    const sortedData = useMemo(() => {
        if (!sortConfig) return filteredData;
        return [...filteredData].sort((a, b) => {
            const aVal = a[sortConfig.key];
            const bVal = b[sortConfig.key];

            if (aVal === undefined || aVal === null) return 1;
            if (bVal === undefined || bVal === null) return -1;

            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredData, sortConfig]);

    // Pagination Logic
    const totalPages = Math.ceil(sortedData.length / rowsPerPage);
    const startIndex = (currentPage - 1) * rowsPerPage;
    const paginatedData = sortedData.slice(startIndex, startIndex + rowsPerPage);


    return (
        <div className="w-full">
            {/* Controls */}
            {/* Increased vertical gap for mobile stacking and bottom margin for table separation */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-y-4 gap-x-6">
                <div className={styles.searchContainer}>
                    <Search className={styles.searchIcon} />
                    <input
                        type="text"
                        placeholder="Search by any field..."
                        className={styles.searchInput}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                {/* Added gap-y-4 for vertical stack on very small screens, though flex-row usually handles it */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
                    {/* Flag Filter Toggle */}
                    <div className="relative w-full sm:w-auto">
                        <Button
                            size="md"
                            variant="outline"
                            onClick={() => setIsFlagMenuOpen(!isFlagMenuOpen)}
                            className={clsx("flex items-center justify-between sm:justify-center gap-2 w-full sm:w-auto", selectedFlags.size > 0 && "border-blue-500 text-blue-600 bg-blue-50")}
                        >
                            <span className="flex items-center gap-2">
                                <span className="font-semibold">Filter Flags</span>
                                {selectedFlags.size > 0 && <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">{selectedFlags.size}</span>}
                            </span>
                            <ChevronDown size={14} />
                        </Button>

                        {isFlagMenuOpen && (
                            <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-lg shadow-xl z-30 p-3 max-h-80 overflow-y-auto">
                                <div className="text-xs font-bold text-slate-900 uppercase px-2 py-2 mb-2 border-b border-slate-100 flex justify-between items-center">
                                    <span>Filter Flags</span>
                                    {selectedFlags.size > 0 && <span onClick={() => setSelectedFlags(new Set())} className="text-blue-500 cursor-pointer hover:underline text-[10px] lowercase">clear</span>}
                                </div>
                                {allFlags.length === 0 && <div className="text-sm text-slate-400 px-2 py-2">No flags found</div>}
                                {allFlags.map(flag => (
                                    <label key={flag} className="flex items-center px-3 py-3 hover:bg-slate-50 rounded-md cursor-pointer text-sm text-slate-700 font-medium mb-1 last:mb-0 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={selectedFlags.has(flag)}
                                            onChange={() => toggleFlag(flag)}
                                            className="mr-3 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        {flag}
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Column Visibility Toggle */}
                    <div className="relative w-full sm:w-auto">
                        <Button
                            size="md"
                            variant="outline"
                            onClick={() => setIsColumnMenuOpen(!isColumnMenuOpen)}
                            className="flex items-center justify-between sm:justify-center gap-2 w-full sm:w-auto"
                        >
                            <span className="flex items-center gap-2">
                                <Columns size={18} />
                                Columns
                            </span>
                            <ChevronDown size={14} />
                        </Button>

                        {isColumnMenuOpen && (
                            <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-lg shadow-xl z-30 p-3 max-h-80 overflow-y-auto">
                                <div className="text-xs font-bold text-slate-900 uppercase px-2 py-2 mb-2 border-b border-slate-100">Toggle Columns</div>
                                {COLUMNS.map(col => (
                                    <label key={col.key} className="flex items-center px-3 py-3 hover:bg-slate-50 rounded-md cursor-pointer text-sm text-slate-700 font-medium mb-1 last:mb-0 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={visibleColumns.has(col.key)}
                                            onChange={() => toggleColumn(col.key)}
                                            className="mr-3 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        {col.label}
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <Card className={styles.container}>
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead className={styles.thead}>
                            <tr>
                                {COLUMNS.filter(col => visibleColumns.has(col.key)).map((col) => (
                                    <th
                                        key={col.key}
                                        className={styles.th}
                                        onClick={() => handleSort(col.key)}
                                        style={{ minWidth: col.width }}
                                    >
                                        <div className="flex items-center cursor-pointer select-none hover:text-blue-600 transition-colors">
                                            {col.label}
                                            <div className="ml-1 w-4 h-4 flex items-center justify-center">
                                                {sortConfig?.key === col.key ? (
                                                    sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                                                ) : (
                                                    <ArrowUpDown size={12} className="opacity-30" />
                                                )}
                                            </div>
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedData.map((row) => (
                                <tr
                                    key={row.id}
                                    className={`${styles.tr} cursor-pointer`}
                                    onClick={() => router.push(`/client/${row.client_id || 'client-001'}`)}
                                >
                                    {COLUMNS.filter(col => visibleColumns.has(col.key)).map(col => (
                                        <td key={col.key} className={styles.td}>
                                            {col.key === 'policy_number' ? (
                                                <span className="font-medium text-blue-600">{row[col.key]}</span>
                                            ) : col.key === 'status' ? (
                                                <span className={clsx(
                                                    styles.badge,
                                                    row.status === 'Pending Review' && styles.badgePending,
                                                    row.status === 'Approved' && styles.badgeApproved,
                                                    row.status === 'Rejected' && styles.badgeRejected,
                                                    row.status === 'Incomplete' && styles.badgeGray
                                                )}>
                                                    {row.status}
                                                </span>
                                            ) : col.key === 'flags' ? (
                                                <div className="flex flex-wrap gap-1">
                                                    {row.flags && row.flags.map((flag, i) => (
                                                        <span key={i} className={styles.flagBadge}>{flag}</span>
                                                    ))}
                                                </div>
                                            ) : (
                                                // Default cell render
                                                row[col.key] as React.ReactNode
                                            )}
                                        </td>
                                    ))}
                                    <td className={styles.td}>
                                        <Link
                                            href={`/client/${row.client_id || 'client-001'}`}
                                            className={styles.actionBtn}
                                        >
                                            View Client
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                            {paginatedData.length === 0 && (
                                <tr>
                                    <td colSpan={visibleColumns.size} className="p-8 text-center text-slate-500">
                                        No results found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Pagination Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between mt-4 gap-4">
                <div className="relative">
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setIsRowsPerPageMenuOpen(!isRowsPerPageMenuOpen)}
                        className="flex items-center gap-2 border border-slate-200"
                    >
                        <span className="text-slate-600 font-normal">Rows per page: <span className="font-semibold text-slate-900">{rowsPerPage}</span></span>
                        <ChevronDown size={14} className="text-slate-500" />
                    </Button>

                    {isRowsPerPageMenuOpen && (
                        <div className="absolute bottom-full left-0 mb-2 w-32 bg-white border border-slate-200 rounded-lg shadow-xl z-30 overflow-hidden">
                            {[5, 10, 25, 50, 100].map(option => (
                                <button
                                    key={option}
                                    onClick={() => {
                                        setRowsPerPage(option);
                                        setCurrentPage(1);
                                        setIsRowsPerPageMenuOpen(false);
                                    }}
                                    className={clsx(
                                        "w-full text-left px-4 py-2 text-sm hover:bg-slate-50 transition-colors",
                                        rowsPerPage === option ? "text-blue-600 font-semibold bg-blue-50" : "text-slate-700"
                                    )}
                                >
                                    {option}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 mr-2">
                        Page {currentPage} of {Math.max(1, totalPages)}
                    </span>
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        className="h-8 px-2"
                    >
                        Previous
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        className="h-8 px-2"
                    >
                        Next
                    </Button>
                </div>
            </div>

            {/* Click overlay to close menus */}
            {(isColumnMenuOpen || isFlagMenuOpen || isRowsPerPageMenuOpen) && (
                <div
                    className="fixed inset-0 z-10"
                    onClick={() => {
                        setIsColumnMenuOpen(false);
                        setIsFlagMenuOpen(false);
                        setIsRowsPerPageMenuOpen(false);
                    }}
                />
            )}
        </div>
    );

}
