// Helper to convert snake_case object keys to camelCase
export function toCamelCase(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    result[camelKey] = value;
  }
  return result;
}

export function toCamelCaseArray(arr: Record<string, any>[]): Record<string, any>[] {
  return arr.map(toCamelCase);
}
