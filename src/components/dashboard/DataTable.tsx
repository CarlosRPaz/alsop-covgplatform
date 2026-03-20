'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/Card/Card';
import styles from './DataTable.module.scss';
import { clsx } from 'clsx';
import { fetchDashboardPolicies, DashboardPolicy } from '@/lib/api';
import { ArrowUpDown, Search, ChevronDown, ChevronUp, Columns, ArrowUp, ArrowDown, EyeOff, X, GripVertical, Flag, ChevronFirst, ChevronLast } from 'lucide-react';
import { Button } from '@/components/ui/Button/Button';
import { useRouter } from 'next/navigation';

// localStorage keys (v2 — reset to pick up new column order & visibility defaults)
const LS_VISIBLE_COLUMNS = 'cfp_datatable_visibleColumns_v2';
const LS_COLUMN_ORDER = 'cfp_datatable_columnOrder_v2';
const LS_SELECTED_FLAGS = 'cfp_datatable_selectedFlags';

// Helpers
function loadFromStorage<T>(key: string, fallback: T): T {
    if (typeof window === 'undefined') return fallback;
    try {
        const raw = localStorage.getItem(key);
        if (raw === null) return fallback;
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
}

function saveToStorage(key: string, value: unknown) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch { /* quota exceeded – silently fail */ }
}

// Column definition type
type ColumnDef = { key: keyof DashboardPolicy; label: string; width?: string };

// Policy-centric columns — ordered by agent importance
const INITIAL_COLUMNS: ColumnDef[] = [
    { key: 'policy_number', label: 'Policy #' },
    { key: 'flag_count', label: 'Flags' },
    { key: 'named_insured', label: 'Insured Name', width: '200px' },
    { key: 'status', label: 'Status' },
    { key: 'effective_date', label: 'Effective Date' },
    { key: 'expiration_date', label: 'Expiration Date' },
    { key: 'annual_premium', label: 'Annual Premium' },
    { key: 'property_address', label: 'Property Address', width: '250px' },
    { key: 'mailing_address', label: 'Mailing Address', width: '250px' },
    { key: 'carrier_name', label: 'Carrier' },
];

// All columns visible by default
const DEFAULT_VISIBLE_KEYS = new Set([
    'policy_number', 'flag_count', 'named_insured', 'status',
    'effective_date', 'expiration_date', 'annual_premium',
    'property_address', 'mailing_address', 'carrier_name',
]);

// Column Header Popup Component
interface ColumnPopupProps {
    column: ColumnDef;
    isOpen: boolean;
    onClose: () => void;
    onSort: (direction: 'asc' | 'desc' | null) => void;
    onHide: () => void;
    currentSort: { key: keyof DashboardPolicy; direction: 'asc' | 'desc' } | null;
    columnSearch: string;
    onColumnSearch: (value: string) => void;
    position: { top: number; left: number };
}

function ColumnPopup({
    column,
    isOpen,
    onClose,
    onSort,
    onHide,
    currentSort,
    columnSearch,
    onColumnSearch,
    position
}: ColumnPopupProps) {
    const popupRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const isCurrentlySorted = currentSort?.key === column.key;
    const currentDirection = isCurrentlySorted ? currentSort.direction : null;

    return (
        <div
            ref={popupRef}
            className={styles.columnPopup}
            style={{ top: position.top, left: position.left }}
            onClick={(e) => e.stopPropagation()}
        >
            <div className={styles.popupHeader}>
                <span className={styles.popupTitle}>{column.label}</span>
                <button className={styles.popupClose} onClick={onClose}>
                    <X size={14} />
                </button>
            </div>

            {/* Sort Section */}
            <div className={styles.popupSection}>
                <div className={styles.popupSectionTitle}>Sort</div>
                <button
                    className={clsx(styles.popupOption, currentDirection === 'asc' && styles.popupOptionActive)}
                    onClick={() => onSort('asc')}
                >
                    <ArrowUp size={14} />
                    <span>Sort A → Z</span>
                </button>
                <button
                    className={clsx(styles.popupOption, currentDirection === 'desc' && styles.popupOptionActive)}
                    onClick={() => onSort('desc')}
                >
                    <ArrowDown size={14} />
                    <span>Sort Z → A</span>
                </button>
                {isCurrentlySorted && (
                    <button
                        className={styles.popupOption}
                        onClick={() => onSort(null)}
                    >
                        <X size={14} />
                        <span>Clear Sort</span>
                    </button>
                )}
            </div>

            {/* Search Section */}
            <div className={styles.popupSection}>
                <div className={styles.popupSectionTitle}>Search in "{column.label}"</div>
                <div className={styles.popupSearchContainer}>
                    <Search size={14} className={styles.popupSearchIcon} />
                    <input
                        type="text"
                        placeholder="Type to filter..."
                        className={styles.popupSearchInput}
                        value={columnSearch}
                        onChange={(e) => onColumnSearch(e.target.value)}
                        autoFocus
                    />
                    {columnSearch && (
                        <button
                            className={styles.popupSearchClear}
                            onClick={() => onColumnSearch('')}
                        >
                            <X size={12} />
                        </button>
                    )}
                </div>
            </div>

            {/* Actions Section */}
            <div className={styles.popupSection}>
                <button className={styles.popupOption} onClick={onHide}>
                    <EyeOff size={14} />
                    <span>Hide Column</span>
                </button>
            </div>
        </div>
    );
}

interface DataTableProps {
    initialSearch?: string;
    initialExpirationFilter?: { from?: string; to?: string };
    initialStatusFilter?: string;
    filterLabel?: string;
}

export function DataTable({ initialSearch, initialExpirationFilter, initialStatusFilter, filterLabel }: DataTableProps = {}) {
    const router = useRouter();
    const [data, setData] = useState<DashboardPolicy[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sortConfig, setSortConfig] = useState<{ key: keyof DashboardPolicy; direction: 'asc' | 'desc' } | null>(null);
    const [searchQuery, setSearchQuery] = useState(initialSearch || '');

    // Track whether localStorage preferences have been loaded
    const [prefsLoaded, setPrefsLoaded] = useState(false);

    // Column Order State (for drag-and-drop reordering)
    const [columnOrder, setColumnOrder] = useState<ColumnDef[]>(INITIAL_COLUMNS);
    const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
    const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

    // Column Visibility State
    const [visibleColumns, setVisibleColumns] = useState<Set<string>>(DEFAULT_VISIBLE_KEYS);
    const [isColumnMenuOpen, setIsColumnMenuOpen] = useState(false);

    // Column Popup State
    const [activeColumnPopup, setActiveColumnPopup] = useState<string | null>(null);
    const [columnSearchQueries, setColumnSearchQueries] = useState<Record<string, string>>({});
    const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0 });

    // Refs for click-outside detection
    const flagMenuRef = useRef<HTMLDivElement>(null);
    const columnMenuRef = useRef<HTMLDivElement>(null);
    const rowsPerPageMenuRef = useRef<HTMLDivElement>(null);
    const rowsPerPageMenuTopRef = useRef<HTMLDivElement>(null);

    // Flag Filtering State
    const [allFlags, setAllFlags] = useState<string[]>([]);
    const [selectedFlags, setSelectedFlags] = useState<Set<string>>(new Set());
    const [isFlagMenuOpen, setIsFlagMenuOpen] = useState(false);
    const [flagSeverityFilter, setFlagSeverityFilter] = useState<string>('all');
    const [flagSearch, setFlagSearch] = useState('');

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [isRowsPerPageMenuOpen, setIsRowsPerPageMenuOpen] = useState(false);

    // --- Load preferences from localStorage on mount ---
    useEffect(() => {
        // Visible columns
        const savedVisible = loadFromStorage<string[] | null>(LS_VISIBLE_COLUMNS, null);
        if (savedVisible) setVisibleColumns(new Set(savedVisible));

        // Column order (stored as key strings — rebuild ColumnDef from INITIAL_COLUMNS)
        const savedOrder = loadFromStorage<string[] | null>(LS_COLUMN_ORDER, null);
        if (savedOrder) {
            const colMap = new Map(INITIAL_COLUMNS.map(c => [c.key, c]));
            const restored: ColumnDef[] = [];
            savedOrder.forEach(key => {
                const col = colMap.get(key as keyof DashboardPolicy);
                if (col) restored.push(col);
            });
            // Append any new columns that weren't in saved order
            INITIAL_COLUMNS.forEach(c => {
                if (!restored.find(r => r.key === c.key)) restored.push(c);
            });
            setColumnOrder(restored);
        }

        // Selected flags
        const savedFlags = loadFromStorage<string[] | null>(LS_SELECTED_FLAGS, null);
        if (savedFlags) setSelectedFlags(new Set(savedFlags));

        setPrefsLoaded(true);
    }, []);

    // --- Save preferences to localStorage on change ---
    useEffect(() => {
        if (!prefsLoaded) return;
        saveToStorage(LS_VISIBLE_COLUMNS, Array.from(visibleColumns));
    }, [visibleColumns, prefsLoaded]);

    useEffect(() => {
        if (!prefsLoaded) return;
        saveToStorage(LS_COLUMN_ORDER, columnOrder.map(c => c.key));
    }, [columnOrder, prefsLoaded]);

    useEffect(() => {
        if (!prefsLoaded) return;
        saveToStorage(LS_SELECTED_FLAGS, Array.from(selectedFlags));
    }, [selectedFlags, prefsLoaded]);

    useEffect(() => {
        setLoading(true);
        setError(null);
        fetchDashboardPolicies()
            .then(fetchedData => {
                setData(fetchedData);
                // Extract unique flag codes from all policies
                const codes = new Set<string>();
                fetchedData.forEach(p => {
                    if (p.flags) p.flags.forEach(f => codes.add(f.code));
                });
                setAllFlags(Array.from(codes).sort());
                if (fetchedData.length === 0) {
                    setError('No policies found. Upload and process declarations to see data here.');
                }
            })
            .catch(err => {
                console.error('DataTable fetch error:', err);
                setError(`Failed to fetch data: ${err.message}`);
            })
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, selectedFlags, columnSearchQueries]);

    // Click-outside handler for Status, Columns, and Rows-per-page menus
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (isFlagMenuOpen && flagMenuRef.current && !flagMenuRef.current.contains(e.target as Node)) {
                setIsFlagMenuOpen(false);
            }
            if (isColumnMenuOpen && columnMenuRef.current && !columnMenuRef.current.contains(e.target as Node)) {
                setIsColumnMenuOpen(false);
            }
            if (isRowsPerPageMenuOpen && rowsPerPageMenuRef.current && !rowsPerPageMenuRef.current.contains(e.target as Node) && rowsPerPageMenuTopRef.current && !rowsPerPageMenuTopRef.current.contains(e.target as Node)) {
                setIsRowsPerPageMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isFlagMenuOpen, isColumnMenuOpen, isRowsPerPageMenuOpen]);

    const handleSort = (key: keyof DashboardPolicy, direction: 'asc' | 'desc' | null) => {
        if (direction === null) {
            setSortConfig(null);
        } else {
            setSortConfig({ key, direction });
        }
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

    const handleColumnHeaderClick = (e: React.MouseEvent, columnKey: string) => {
        e.stopPropagation();
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setPopupPosition({
            top: rect.bottom + 8,
            left: Math.min(rect.left, window.innerWidth - 280)
        });
        setActiveColumnPopup(activeColumnPopup === columnKey ? null : columnKey);
    };

    const handleColumnSearch = (columnKey: string, value: string) => {
        setColumnSearchQueries(prev => ({
            ...prev,
            [columnKey]: value
        }));
    };

    // Drag and Drop handlers for column reordering
    const handleDragStart = (e: React.DragEvent, columnKey: string) => {
        setDraggedColumn(columnKey);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent, columnKey: string) => {
        e.preventDefault();
        if (draggedColumn && draggedColumn !== columnKey) {
            setDragOverColumn(columnKey);
        }
    };

    const handleDragEnd = () => {
        if (draggedColumn && dragOverColumn) {
            const newOrder = [...columnOrder];
            const draggedIndex = newOrder.findIndex(c => c.key === draggedColumn);
            const targetIndex = newOrder.findIndex(c => c.key === dragOverColumn);

            if (draggedIndex !== -1 && targetIndex !== -1) {
                const [removed] = newOrder.splice(draggedIndex, 1);
                newOrder.splice(targetIndex, 0, removed);
                setColumnOrder(newOrder);
            }
        }
        setDraggedColumn(null);
        setDragOverColumn(null);
    };

    // Move column in the column menu
    const moveColumn = (columnKey: string, direction: 'up' | 'down') => {
        const newOrder = [...columnOrder];
        const index = newOrder.findIndex(c => c.key === columnKey);
        if (direction === 'up' && index > 0) {
            [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
        } else if (direction === 'down' && index < newOrder.length - 1) {
            [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
        }
        setColumnOrder(newOrder);
    };

    const filteredData = useMemo(() => {
        let result = data;

        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            result = result.filter(item => {
                return Object.values(item).some(val =>
                    val && String(val).toLowerCase().includes(lowerQuery)
                );
            });
        }

        Object.entries(columnSearchQueries).forEach(([columnKey, query]) => {
            if (query) {
                const lowerQuery = query.toLowerCase();
                result = result.filter(item => {
                    const val = item[columnKey as keyof DashboardPolicy];
                    if (Array.isArray(val)) {
                        return val.some(v => String(v).toLowerCase().includes(lowerQuery));
                    }
                    return val && String(val).toLowerCase().includes(lowerQuery);
                });
            }
        });

        // Flag severity filter
        if (flagSeverityFilter !== 'all') {
            result = result.filter(item =>
                item.flags?.some(f => f.severity === flagSeverityFilter)
            );
        }

        // Flag code filter (multi-select, stackable)
        if (selectedFlags.size > 0) {
            result = result.filter(item =>
                item.flags?.some(f => selectedFlags.has(f.code))
            );
        }

        // Expiration date range filter (from dashboard drill-down)
        if (initialExpirationFilter?.from || initialExpirationFilter?.to) {
            result = result.filter(item => {
                if (!item.expiration_date) return false;
                const expMs = new Date(item.expiration_date).getTime();
                if (initialExpirationFilter.from && expMs < new Date(initialExpirationFilter.from).getTime()) return false;
                if (initialExpirationFilter.to && expMs >= new Date(initialExpirationFilter.to).getTime()) return false;
                return true;
            });
        }

        // Status filter (from dashboard drill-down)
        if (initialStatusFilter) {
            if (initialStatusFilter === 'pending_review') {
                result = result.filter(item =>
                    item.status === 'pending_review' || item.status === 'unknown'
                );
            } else {
                result = result.filter(item => item.status === initialStatusFilter);
            }
        }

        return result;
    }, [data, searchQuery, selectedFlags, flagSeverityFilter, columnSearchQueries, initialExpirationFilter, initialStatusFilter]);

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

    const totalPages = Math.ceil(sortedData.length / rowsPerPage);
    const startIndex = (currentPage - 1) * rowsPerPage;
    const paginatedData = sortedData.slice(startIndex, startIndex + rowsPerPage);

    const activeColumnFilters = Object.values(columnSearchQueries).filter(v => v).length;

    // Get visible columns in the current order
    const orderedVisibleColumns = columnOrder.filter(col => visibleColumns.has(col.key));

    return (
        <div className="w-full">
            {/* Drill-down filter chips */}
            {filterLabel && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 0.75rem',
                    marginBottom: '0.625rem',
                    background: 'rgba(99, 102, 241, 0.06)',
                    border: '1px solid rgba(99, 102, 241, 0.15)',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
                    <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '0.2rem 0.5rem',
                        fontWeight: 500,
                        color: '#c7d2fe',
                        background: 'rgba(99, 102, 241, 0.12)',
                        border: '1px solid rgba(99, 102, 241, 0.2)',
                        borderRadius: '4px',
                        textTransform: 'capitalize' as const,
                        cursor: 'pointer',
                    }}
                        onClick={() => router.push('/dashboard')}
                        role="button"
                    >
                        {filterLabel}
                        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </span>
                    <span style={{ marginLeft: 'auto', fontSize: '0.68rem', color: '#64748b' }}>
                        Showing {filteredData.length} of {data.length} policies
                    </span>
                </div>
            )}
            {/* Controls - Redesigned to match reference */}
            <div className={styles.controlsBar}>
                <div className={styles.searchContainer}>
                    <Search className={styles.searchIcon} />
                    <input
                        type="text"
                        placeholder="Search all columns..."
                        className={styles.searchInput}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className={styles.controlButtons}>
                    {/* Active Filters Indicator */}
                    {activeColumnFilters > 0 && (
                        <div className={styles.activeFiltersTag}>
                            <span>{activeColumnFilters} filter{activeColumnFilters > 1 ? 's' : ''}</span>
                            <button onClick={() => setColumnSearchQueries({})}>
                                <X size={12} />
                            </button>
                        </div>
                    )}

                    {/* Status/Flag Filter - Pill Button Style */}
                    <div className="relative" ref={flagMenuRef}>
                        <button
                            onClick={() => setIsFlagMenuOpen(prev => !prev)}
                            className={clsx(
                                styles.pillButton,
                                (selectedFlags.size > 0 || flagSeverityFilter !== 'all') && styles.pillButtonActive
                            )}
                        >
                            <Flag size={16} />
                            <span>Flags</span>
                            {(selectedFlags.size > 0 || flagSeverityFilter !== 'all') && (
                                <span className={styles.pillBadge}>{selectedFlags.size + (flagSeverityFilter !== 'all' ? 1 : 0)}</span>
                            )}
                            <ChevronDown size={14} />
                        </button>

                        {isFlagMenuOpen && (
                            <div className={styles.dropdownMenu}>
                                <div className={styles.dropdownHeader}>
                                    <span>Filter by Flags</span>
                                    {(selectedFlags.size > 0 || flagSeverityFilter !== 'all') && (
                                        <button onClick={() => { setSelectedFlags(new Set()); setFlagSeverityFilter('all'); }} className={styles.clearLink}>
                                            clear all
                                        </button>
                                    )}
                                </div>

                                {/* Severity radio chips */}
                                <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                    <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.35rem', letterSpacing: '0.04em' }}>Severity</div>
                                    <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                                        {['all', 'critical', 'high', 'warning', 'info'].map(sev => (
                                            <button
                                                key={sev}
                                                onClick={() => setFlagSeverityFilter(sev)}
                                                style={{
                                                    padding: '2px 8px',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    fontSize: '0.7rem',
                                                    fontWeight: 600,
                                                    cursor: 'pointer',
                                                    textTransform: 'capitalize',
                                                    background: flagSeverityFilter === sev
                                                        ? sev === 'critical' ? 'rgba(239,68,68,0.15)'
                                                            : sev === 'high' ? 'rgba(249,115,22,0.15)'
                                                                : sev === 'warning' ? 'rgba(234,179,8,0.15)'
                                                                    : sev === 'info' ? 'rgba(59,130,246,0.15)'
                                                                        : 'rgba(59,130,246,0.15)'
                                                        : 'transparent',
                                                    color: flagSeverityFilter === sev
                                                        ? sev === 'critical' ? '#f87171'
                                                            : sev === 'high' ? '#fb923c'
                                                                : sev === 'warning' ? '#facc15'
                                                                    : sev === 'info' ? '#60a5fa'
                                                                        : '#60a5fa'
                                                        : '#64748b',
                                                }}
                                            >
                                                {sev === 'all' ? 'All' : sev}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Flag code search */}
                                <div style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                    <input
                                        type="text"
                                        placeholder="Search flag types..."
                                        value={flagSearch}
                                        onChange={e => setFlagSearch(e.target.value)}
                                        style={{
                                            width: '100%',
                                            background: 'rgba(255,255,255,0.04)',
                                            border: '1px solid rgba(255,255,255,0.08)',
                                            borderRadius: '4px',
                                            padding: '4px 8px',
                                            fontSize: '0.75rem',
                                            color: '#e2e8f0',
                                            outline: 'none',
                                        }}
                                    />
                                </div>

                                {/* Flag code checkboxes */}
                                {allFlags.filter(f => !flagSearch || f.toLowerCase().includes(flagSearch.toLowerCase())).length === 0 && (
                                    <div className={styles.dropdownEmpty}>No flags found</div>
                                )}
                                {allFlags
                                    .filter(f => !flagSearch || f.toLowerCase().includes(flagSearch.toLowerCase()))
                                    .map(flag => (
                                        <label key={flag} className={styles.dropdownItem}>
                                            <input
                                                type="checkbox"
                                                checked={selectedFlags.has(flag)}
                                                onChange={() => toggleFlag(flag)}
                                            />
                                            <span style={{ textTransform: 'capitalize' }}>{flag.replace(/_/g, ' ').toLowerCase()}</span>
                                        </label>
                                    ))}
                            </div>
                        )}
                    </div>

                    {/* Columns - Pill Button Style */}
                    <div className="relative" ref={columnMenuRef}>
                        <button
                            onClick={() => setIsColumnMenuOpen(prev => !prev)}
                            className={styles.pillButton}
                        >
                            <Columns size={16} />
                            <span>Columns</span>
                            <ChevronDown size={14} />
                        </button>

                        {isColumnMenuOpen && (
                            <div className={clsx(styles.dropdownMenu, styles.columnDropdown)}>
                                <div className={styles.dropdownHeader}>
                                    <span>Manage Columns</span>
                                    <span className={styles.dropdownHint}>Drag to reorder</span>
                                </div>
                                {columnOrder.map((col, index) => (
                                    <div
                                        key={col.key}
                                        className={clsx(
                                            styles.columnItem,
                                            dragOverColumn === col.key && styles.columnItemDragOver
                                        )}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, col.key)}
                                        onDragOver={(e) => handleDragOver(e, col.key)}
                                        onDragEnd={handleDragEnd}
                                    >
                                        <div className={styles.columnItemLeft}>
                                            <GripVertical size={14} className={styles.dragHandle} />
                                            <input
                                                type="checkbox"
                                                checked={visibleColumns.has(col.key)}
                                                onChange={() => toggleColumn(col.key)}
                                            />
                                            <span>{col.label}</span>
                                        </div>
                                        <div className={styles.columnItemArrows}>
                                            <button
                                                onClick={() => moveColumn(col.key, 'up')}
                                                disabled={index === 0}
                                                className={styles.arrowBtn}
                                            >
                                                <ChevronUp size={12} />
                                            </button>
                                            <button
                                                onClick={() => moveColumn(col.key, 'down')}
                                                disabled={index === columnOrder.length - 1}
                                                className={styles.arrowBtn}
                                            >
                                                <ChevronDown size={12} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Top Pagination Controls */}
            <div className={styles.paginationBar}>
                <div className={styles.paginationInfo}>
                    Showing <strong>{sortedData.length === 0 ? 0 : startIndex + 1}</strong>–<strong>{Math.min(startIndex + rowsPerPage, sortedData.length)}</strong> of <strong>{sortedData.length}</strong> results
                </div>

                <div className={styles.paginationControls}>
                    <div className={styles.rowsPerPage} ref={rowsPerPageMenuTopRef}>
                        <button
                            className={styles.rowsPerPageButton}
                            onClick={() => setIsRowsPerPageMenuOpen(prev => !prev)}
                        >
                            <span>{rowsPerPage} per page</span>
                            <ChevronDown size={14} />
                        </button>

                        {isRowsPerPageMenuOpen && (
                            <div className={styles.rowsPerPageMenu}>
                                {[5, 10, 25, 50, 100].map(option => (
                                    <button
                                        key={option}
                                        className={clsx(
                                            styles.rowsPerPageOption,
                                            rowsPerPage === option && styles.rowsPerPageOptionActive
                                        )}
                                        onClick={() => {
                                            setRowsPerPage(option);
                                            setCurrentPage(1);
                                            setIsRowsPerPageMenuOpen(false);
                                        }}
                                    >
                                        {option}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <span className={styles.pageIndicator}>
                        Page {currentPage} of {Math.max(1, totalPages)}
                    </span>

                    <div className={styles.pageButtons}>
                        <button
                            className={styles.pageButton}
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(1)}
                            title="First page"
                        >
                            <ChevronFirst size={16} />
                        </button>
                        <button
                            className={styles.pageButton}
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        >
                            Previous
                        </button>
                        <button
                            className={styles.pageButton}
                            disabled={currentPage >= totalPages}
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        >
                            Next
                        </button>
                        <button
                            className={styles.pageButton}
                            disabled={currentPage >= totalPages}
                            onClick={() => setCurrentPage(totalPages)}
                            title="Last page"
                        >
                            <ChevronLast size={16} />
                        </button>
                    </div>
                </div>
            </div>

            <Card className={styles.container}>
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead className={styles.thead}>
                            <tr>
                                {orderedVisibleColumns.map((col) => (
                                    <th
                                        key={col.key}
                                        className={clsx(
                                            styles.th,
                                            styles.thClickable,
                                            columnSearchQueries[col.key] && styles.thFiltered,
                                            draggedColumn === col.key && styles.thDragging
                                        )}
                                        onClick={(e) => handleColumnHeaderClick(e, col.key)}
                                        style={{ minWidth: col.width }}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, col.key)}
                                        onDragOver={(e) => handleDragOver(e, col.key)}
                                        onDragEnd={handleDragEnd}
                                    >
                                        <div className="flex items-center cursor-pointer select-none">
                                            <span>{col.label}</span>
                                            <div className="ml-1 w-4 h-4 flex items-center justify-center">
                                                {sortConfig?.key === col.key ? (
                                                    sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                                                ) : (
                                                    <ArrowUpDown size={12} className="opacity-30" />
                                                )}
                                            </div>
                                            {columnSearchQueries[col.key] && (
                                                <div className={styles.columnFilterIndicator}>
                                                    <Search size={10} />
                                                </div>
                                            )}
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
                                    onClick={() => router.push(`/policy/${row.id}`)}
                                >
                                    {orderedVisibleColumns.map(col => (
                                        <td key={col.key} className={styles.td}>
                                            {col.key === 'policy_number' ? (
                                                <span className="font-medium text-blue-600">{row[col.key]}</span>
                                            ) : col.key === 'named_insured' ? (
                                                <span
                                                    className={styles.clientLink}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        router.push(`/client/${row.client_id}`);
                                                    }}
                                                >
                                                    {row.named_insured}
                                                </span>
                                            ) : col.key === 'status' ? (
                                                <span className={clsx(
                                                    styles.badge,
                                                    row.status === 'unknown' && styles.badgeGray,
                                                    row.status === 'active' && styles.badgeApproved,
                                                    row.status === 'expired' && styles.badgeRejected,
                                                    row.status === 'pending' && styles.badgePending
                                                )}>
                                                    {row.status}
                                                </span>
                                            ) : col.key === 'flag_count' ? (
                                                row.flags && row.flags.length > 0 ? (
                                                    <div className={styles.flagPillsWrap}>
                                                        {row.flags.slice(0, 3).map((f: { code: string; title: string; severity: string }, i: number) => (
                                                            <span
                                                                key={`${f.code}-${i}`}
                                                                className={clsx(
                                                                    styles.flagPill,
                                                                    f.severity === 'critical' && styles.flagPillCritical,
                                                                    f.severity === 'high' && styles.flagPillHigh,
                                                                    f.severity === 'warning' && styles.flagPillWarning,
                                                                    f.severity === 'info' && styles.flagPillInfo,
                                                                )}
                                                                title={`${f.code}: ${f.title}`}
                                                            >
                                                                {f.title}
                                                            </span>
                                                        ))}
                                                        {row.flags.length > 3 && (
                                                            <span className={styles.flagPillMore}>
                                                                +{row.flags.length - 3}
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : row.flag_count > 0 ? (
                                                    <span className={clsx(
                                                        styles.flagCountBadge,
                                                        row.highest_severity === 'critical' && styles.flagCritical,
                                                        row.highest_severity === 'warning' && styles.flagWarning,
                                                        row.highest_severity === 'info' && styles.flagInfo,
                                                    )}>
                                                        <Flag size={12} />
                                                        {row.flag_count}
                                                    </span>
                                                ) : (
                                                    <span className={styles.flagCountNone}>—</span>
                                                )
                                            ) : (
                                                (row[col.key] ?? '') as React.ReactNode
                                            )}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                            {loading && (
                                <tr>
                                    <td colSpan={visibleColumns.size} className="p-8 text-center text-slate-500">
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                                            <span>Loading from Supabase...</span>
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {!loading && error && (
                                <tr>
                                    <td colSpan={visibleColumns.size} className="p-8 text-center">
                                        <div className="text-red-500 font-medium">{error}</div>
                                        <div className="text-xs text-slate-400 mt-1">Check browser console for details</div>
                                    </td>
                                </tr>
                            )}
                            {!loading && !error && paginatedData.length === 0 && (
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

            {/* Column Header Popups */}
            {orderedVisibleColumns.map(col => (
                <ColumnPopup
                    key={col.key}
                    column={col}
                    isOpen={activeColumnPopup === col.key}
                    onClose={() => setActiveColumnPopup(null)}
                    onSort={(direction) => handleSort(col.key, direction)}
                    onHide={() => {
                        toggleColumn(col.key);
                        setActiveColumnPopup(null);
                    }}
                    currentSort={sortConfig}
                    columnSearch={columnSearchQueries[col.key] || ''}
                    onColumnSearch={(value) => handleColumnSearch(col.key, value)}
                    position={popupPosition}
                />
            ))}

            {/* Pagination Controls */}
            <div className={styles.paginationBar}>
                <div className={styles.paginationInfo}>
                    Showing <strong>{sortedData.length === 0 ? 0 : startIndex + 1}</strong>–<strong>{Math.min(startIndex + rowsPerPage, sortedData.length)}</strong> of <strong>{sortedData.length}</strong> results
                </div>

                <div className={styles.paginationControls}>
                    <div className={styles.rowsPerPage} ref={rowsPerPageMenuRef}>
                        <button
                            className={styles.rowsPerPageButton}
                            onClick={() => setIsRowsPerPageMenuOpen(prev => !prev)}
                        >
                            <span>{rowsPerPage} per page</span>
                            <ChevronDown size={14} />
                        </button>

                        {isRowsPerPageMenuOpen && (
                            <div className={styles.rowsPerPageMenu}>
                                {[5, 10, 25, 50, 100].map(option => (
                                    <button
                                        key={option}
                                        className={clsx(
                                            styles.rowsPerPageOption,
                                            rowsPerPage === option && styles.rowsPerPageOptionActive
                                        )}
                                        onClick={() => {
                                            setRowsPerPage(option);
                                            setCurrentPage(1);
                                            setIsRowsPerPageMenuOpen(false);
                                        }}
                                    >
                                        {option}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <span className={styles.pageIndicator}>
                        Page {currentPage} of {Math.max(1, totalPages)}
                    </span>

                    <div className={styles.pageButtons}>
                        <button
                            className={styles.pageButton}
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(1)}
                            title="First page"
                        >
                            <ChevronFirst size={16} />
                        </button>
                        <button
                            className={styles.pageButton}
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        >
                            Previous
                        </button>
                        <button
                            className={styles.pageButton}
                            disabled={currentPage >= totalPages}
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        >
                            Next
                        </button>
                        <button
                            className={styles.pageButton}
                            disabled={currentPage >= totalPages}
                            onClick={() => setCurrentPage(totalPages)}
                            title="Last page"
                        >
                            <ChevronLast size={16} />
                        </button>
                    </div>
                </div>
            </div>


        </div>
    );
}
