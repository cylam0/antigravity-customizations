# ISSUE-004: Stale Local Storage Deserialization and Format Drift

## Description
Reading serialized preferences or filter selections directly from `localStorage` without validating the format or executing a schema migration when the underlying data representation changes. When data models are updated (e.g., from formatted strings like `YYYY-YY` to numeric years like `YYYY`), stale persisted values will fail to match logic filters, resulting in empty tables or unexpected component states.

## Symptoms
- A filter dropdown rehydrates an old format string (e.g., `"2025-26"`) while comparison logic filters elements by a new numeric string (e.g., `"2025"`).
- Persisting state under the same storage key after the schema format changes, polluting client storage and creating invisible filter mismatch bugs.
- Components displaying empty search results or lists by default on initial page load for returning users.

## Anti-Pattern Code Blocks
```javascript
// Reading directly from localStorage with no migration logic
const storedValue = localStorage.getItem("user-pref-year"); // e.g. yields "2025-26"
const filterValue = storedValue || defaultYear; 

// This will evaluate to false if item.year is 2025
const filtered = items.filter(item => String(item.year) === filterValue);
```

## Remediation Code Blocks
```javascript
// 1. Read stored preference and check/migrate the format
let storedValue = localStorage.getItem("user-pref-year-v2");

// Check if a legacy format exists under a legacy key
if (!storedValue) {
  const legacyValue = localStorage.getItem("user-pref-year-legacy");
  if (legacyValue) {
    // Migrate format (e.g., YYYY-YY -> YYYY)
    storedValue = legacyValue.includes("-") ? legacyValue.split("-")[0] : legacyValue;
    localStorage.setItem("user-pref-year-v2", storedValue);
    localStorage.removeItem("user-pref-year-legacy");
  }
}

// 2. Validate/normalize formatting on load
if (storedValue && /^\d{4}-\d{2}$/.test(storedValue)) {
  storedValue = storedValue.slice(0, 4);
}
```

## Tags
`local-storage`, `migration`, `state-management`
