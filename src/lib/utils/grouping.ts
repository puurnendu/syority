export type GroupedData<T> = T[] | Record<string, T[] | Record<string, any>>;

/**
 * Groups a flat list of items into a nested hierarchy based on provided keys.
 * Support 0, 1, or 2 levels of grouping.
 */
export function groupByHierarchy<T>(
  items: T[],
  keys: (keyof T | ((item: T) => string))[]
): any {
  if (keys.length === 0) return items;

  const grouped: any = {};

  items.forEach((item) => {
    let current = grouped;
    for (let i = 0; i < keys.length; i++) {
        const keyGetter = keys[i];
        const val = typeof keyGetter === 'function' 
            ? keyGetter(item) 
            : String((item as any)[keyGetter] || 'N/A');

        if (i === keys.length - 1) {
            if (!current[val]) current[val] = [];
            current[val].push(item);
        } else {
            if (!current[val]) current[val] = {};
            current = current[val];
        }
    }
  });

  return grouped;
}

/**
 * Sorts keys numerically where possible (e.g., "12\"" before "14\"").
 */
export function sortNumericKeys(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    // Extract numbers: 12" -> 12, #150 -> 150
    const numA = parseFloat(a.replace(/[^\d.]/g, ''));
    const numB = parseFloat(b.replace(/[^\d.]/g, ''));
    
    if (!isNaN(numA) && !isNaN(numB)) {
      if (numA !== numB) return numA - numB;
    }
    return a.localeCompare(b);
  });
}

/**
 * Helper to get total item count in a nested group
 */
export function getGroupCount(group: any): number {
    if (Array.isArray(group)) return group.length;
    return Object.values(group).reduce((sum: number, sub) => sum + getGroupCount(sub), 0);
}
