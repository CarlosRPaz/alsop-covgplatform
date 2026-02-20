'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/Card/Card';
import styles from './DataTable.module.scss';
import { clsx } from 'clsx';
import { fetchSupabaseDeclarations, Declaration } from '@/lib/api';
import { ArrowUpDown, Search, ChevronDown, ChevronUp, Columns, ArrowUp, ArrowDown, EyeOff, X, Filter, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/Button/Button';
import { useRouter } from 'next/navigation';

// localStorage keys
const LS_VISIBLE_COLUMNS = 'cfp_datatable_visibleColumns';
const LS_COLUMN_ORDER = 'cfp_datatable_columnOrder';
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
type ColumnDef = { key: keyof Declaration; label: string; width?: string };

// All columns from parsed_cfpdecpage_data schema
const INITIAL_COLUMNS: ColumnDef[] = [
    // Policy Info
    { key: 'policy_number', label: 'Policy #' },
    { key: 'date_issued', label: 'Date Issued' },
    { key: 'policy_period_start', label: 'Period Start' },
    { key: 'policy_period_end', label: 'Period End' },
    // Insured Info
    { key: 'insured_name', label: 'Insured Name', width: '200px' },
    { key: 'secondary_insured_name', label: 'Secondary Insured' },
    // Addresses
    { key: 'mailing_address', label: 'Mailing Address', width: '250px' },
    { key: 'property_location', label: 'Property Location', width: '250px' },
    // Property Details
    { key: 'year_built', label: 'Year Built' },
    { key: 'occupancy', label: 'Occupancy' },
    { key: 'number_of_units', label: 'Units' },
    { key: 'construction_type', label: 'Construction' },
    { key: 'deductible', label: 'Deductible' },
    // Premium
    { key: 'total_annual_premium', label: 'Annual Premium' },
    // Coverage Limits
    { key: 'limit_dwelling', label: 'Dwelling' },
    { key: 'limit_other_structures', label: 'Other Structures' },
    { key: 'limit_personal_property', label: 'Personal Property' },
    { key: 'limit_fair_rental_value', label: 'Fair Rental Value' },
    { key: 'limit_ordinance_or_law', label: 'Ordinance/Law' },
    { key: 'limit_debris_removal', label: 'Debris Removal' },
    { key: 'limit_extended_dwelling_coverage', label: 'Extended Dwelling' },
    { key: 'limit_dwelling_replacement_cost', label: 'Dwelling Replace Cost' },
    { key: 'limit_inflation_guard', label: 'Inflation Guard' },
    { key: 'limit_personal_property_replacement_cost', label: 'PP Replace Cost' },
    { key: 'limit_fences', label: 'Fences' },
    { key: 'limit_permitted_incidental_occupancy', label: 'Incidental Occ.' },
    { key: 'limit_plants_shrubs_trees', label: 'Plants/Shrubs/Trees' },
    { key: 'limit_outdoor_radio_tv_equipment', label: 'Outdoor Radio/TV' },
    { key: 'limit_awnings', label: 'Awnings' },
    { key: 'limit_signs', label: 'Signs' },
    // Wildfire
    { key: 'wildfire_risk_score_l1', label: 'Wildfire L1' },
    { key: 'wildfire_risk_score_l2', label: 'Wildfire L2' },
    { key: 'wildfire_score_classification_l1', label: 'Wildfire Class L1' },
    { key: 'wildfire_score_classification_l2', label: 'Wildfire Class L2' },
    { key: 'wildfire_premium', label: 'Wildfire Premium' },
    // Broker
    { key: 'broker_name', label: 'Broker' },
    { key: 'broker_address', label: 'Broker Address', width: '200px' },
    { key: 'broker_phone_number', label: 'Broker Phone' },
    // Mortgagees
    { key: 'mortgagee_1_name', label: 'Mortgagee 1' },
    { key: 'mortgagee_1_address', label: 'Mortgagee 1 Addr' },
    { key: 'mortgagee_1_code', label: 'Mortgagee 1 Code' },
    { key: 'mortgagee_2_name', label: 'Mortgagee 2' },
    { key: 'mortgagee_2_address', label: 'Mortgagee 2 Addr' },
    { key: 'mortgagee_2_code', label: 'Mortgagee 2 Code' },
    // System
    { key: 'status', label: 'Status' },
    { key: 'flags', label: 'Flags' },
];

// Default visible columns (key subset for initial view)
const DEFAULT_VISIBLE_KEYS = new Set([
    'policy_number', 'insured_name', 'property_location', 'mailing_address',
    'total_annual_premium', 'year_built', 'occupancy', 'deductible',
    'limit_dwelling', 'broker_name', 'wildfire_risk_score_l1', 'status', 'flags',
]);

// Column Header Popup Component
interface ColumnPopupProps {
    column: ColumnDef;
    isOpen: boolean;
    onClose: () => void;
    onSort: (direction: 'asc' | 'desc' | null) => void;
    onHide: () => void;
    currentSort: { key: keyof Declaration; direction: 'asc' | 'desc' } | null;
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

export function DataTable() {
    const router = useRouter();
    const [data, setData] = useState<Declaration[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sortConfig, setSortConfig] = useState<{ key: keyof Declaration; direction: 'asc' | 'desc' } | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

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

    // Flag Visibility State
    const [allFlags, setAllFlags] = useState<string[]>([]);
    const [selectedFlags, setSelectedFlags] = useState<Set<string>>(new Set());
    const [isFlagMenuOpen, setIsFlagMenuOpen] = useState(false);

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
                const col = colMap.get(key as keyof Declaration);
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
        fetchSupabaseDeclarations()
            .then(fetchedData => {
                setData(fetchedData);
                const flags = new Set<string>();
                fetchedData.forEach(d => d.flags?.forEach(f => flags.add(f)));
                setAllFlags(Array.from(flags).sort());
                if (fetchedData.length === 0) {
                    setError('No data returned from Supabase. Check connection and RLS policies.');
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
            if (isRowsPerPageMenuOpen && rowsPerPageMenuRef.current && !rowsPerPageMenuRef.current.contains(e.target as Node)) {
                setIsRowsPerPageMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isFlagMenuOpen, isColumnMenuOpen, isRowsPerPageMenuOpen]);

    const handleSort = (key: keyof Declaration, direction: 'asc' | 'desc' | null) => {
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
                    const val = item[columnKey as keyof Declaration];
                    if (Array.isArray(val)) {
                        return val.some(v => String(v).toLowerCase().includes(lowerQuery));
                    }
                    return val && String(val).toLowerCase().includes(lowerQuery);
                });
            }
        });

        if (selectedFlags.size > 0) {
            result = result.filter(item => {
                if (!item.flags || item.flags.length === 0) return false;
                return item.flags.some(flag => selectedFlags.has(flag));
            });
        }

        return result;
    }, [data, searchQuery, selectedFlags, columnSearchQueries]);

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
                                selectedFlags.size > 0 && styles.pillButtonActive
                            )}
                        >
                            <Filter size={16} />
                            <span>Status</span>
                            {selectedFlags.size > 0 && (
                                <span className={styles.pillBadge}>{selectedFlags.size}</span>
                            )}
                            <ChevronDown size={14} />
                        </button>

                        {isFlagMenuOpen && (
                            <div className={styles.dropdownMenu}>
                                <div className={styles.dropdownHeader}>
                                    <span>Filter by Status/Flags</span>
                                    {selectedFlags.size > 0 && (
                                        <button onClick={() => setSelectedFlags(new Set())} className={styles.clearLink}>
                                            clear
                                        </button>
                                    )}
                                </div>
                                {allFlags.length === 0 && (
                                    <div className={styles.dropdownEmpty}>No flags found</div>
                                )}
                                {allFlags.map(flag => (
                                    <label key={flag} className={styles.dropdownItem}>
                                        <input
                                            type="checkbox"
                                            checked={selectedFlags.has(flag)}
                                            onChange={() => toggleFlag(flag)}
                                        />
                                        <span>{flag}</span>
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
                                    onClick={() => router.push(`/client/${row.client_id || 'client-001'}`)}
                                >
                                    {orderedVisibleColumns.map(col => (
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
                                                row[col.key] as React.ReactNode
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
                    </div>
                </div>
            </div>


        </div>
    );
}
