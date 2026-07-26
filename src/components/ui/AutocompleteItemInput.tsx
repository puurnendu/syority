'use client';

import { useState, useEffect, useRef } from 'react';

interface CatalogItem {
    id: string;
    item_code: string;
    description: string;
    unit_of_measure: string;
    item_category: string;
    sap_material_number: string | null;
    specification: string | null;
}

interface Props {
    onSelect: (item: CatalogItem) => void;
    onFreeText: (text: string) => void;
    placeholder?: string;
    initialValue?: string;
}

export function AutocompleteItemInput({
    onSelect,
    onFreeText,
    placeholder = 'Type 3+ characters to search catalog...',
    initialValue = '',
}: Props) {
    const [value, setValue] = useState(initialValue);
    const [results, setResults] = useState<CatalogItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const [selected, setSelected] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (value.length < 3 || selected) {
            setResults([]);
            setOpen(false);
            return;
        }
        setLoading(true);
        const timer = setTimeout(async () => {
            try {
                const res = await fetch(
                    '/api/master-data/items?search=' +
                        encodeURIComponent(value) +
                        '&limit=10'
                );
                if (res.ok) {
                    const d = await res.json();
                    setResults(d.items ?? []);
                    setOpen(true);
                }
            } catch {
                setResults([]);
            } finally {
                setLoading(false);
            }
        }, 280);
        return () => clearTimeout(timer);
    }, [value, selected]);

    useEffect(() => {
        function handler(e: MouseEvent) {
            if (
                !inputRef.current?.contains(e.target as Node) &&
                !listRef.current?.contains(e.target as Node)
            ) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    function handleSelect(item: CatalogItem) {
        setValue(item.description);
        setSelected(true);
        setOpen(false);
        setResults([]);
        onSelect(item);
    }

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
        setValue(e.target.value);
        setSelected(false);
        onFreeText(e.target.value);
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Escape') setOpen(false);
    }

    return (
        <div className="relative">
            <label className="text-xs text-gray-500 mb-1 block">
                Description *
            </label>
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    value={value}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    onFocus={() => {
                        if (results.length > 0) setOpen(true);
                    }}
                    placeholder={placeholder}
                    className={
                        selected
                            ? 'w-full border rounded-lg px-3 py-2 text-sm focus:outline-none border-green-400 bg-green-50'
                            : 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500'
                    }
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {loading && (
                        <div className="w-3.5 h-3.5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                    )}
                    {!loading && selected && (
                        <span className="text-green-500 text-sm">✓</span>
                    )}
                    {!loading && !selected && value.length >= 3 && (
                        <span className="text-gray-300 text-xs">🔍</span>
                    )}
                </div>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
                {value.length < 3
                    ? 'Type ' +
                      (3 - value.length) +
                      ' more character(s) to search'
                    : selected
                      ? '✓ Item selected from catalog'
                      : 'Not in catalog — will be saved as draft for admin review'}
            </p>
            {open && results.length > 0 && (
                <div
                    ref={listRef}
                    className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-30 max-h-56 overflow-y-auto"
                >
                    {results.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => handleSelect(item)}
                            className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b border-gray-100 last:border-0"
                        >
                            <div className="flex items-start gap-3">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">
                                        {item.description}
                                    </p>
                                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                        {item.item_code && (
                                            <span className="font-mono text-xs text-gray-400">
                                                {item.item_code}
                                            </span>
                                        )}
                                        {item.sap_material_number && (
                                            <span className="text-xs text-gray-400">
                                                SAP: {item.sap_material_number}
                                            </span>
                                        )}
                                        {item.specification && (
                                            <span className="text-xs text-gray-400 truncate max-w-xs">
                                                {item.specification}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <span className="flex-none text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                                    {item.unit_of_measure}
                                </span>
                            </div>
                        </button>
                    ))}
                    <button
                        type="button"
                        onClick={() => {
                            setSelected(false);
                            setOpen(false);
                            onFreeText(value);
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm text-blue-600 bg-blue-50 hover:bg-blue-100 font-medium"
                    >
                        + Use &quot;{value}&quot; as new item (not in catalog)
                    </button>
                </div>
            )}
        </div>
    );
}
