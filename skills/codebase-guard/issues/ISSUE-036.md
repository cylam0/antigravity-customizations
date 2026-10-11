# ISSUE-036: Unvalidated Temporal Parsing, Rollover, and Formatting

## Description
Parsing date or temporal inputs (e.g., strings, dates, or numbers) using utility helpers without verifying the validity of the resulting timestamp or components. 
1. If an empty, nullish, or invalid string is parsed, operations can yield `Invalid Date` and access to its components returns `NaN`, causing rendering errors like `NaN-NaN-NaN`.
2. If components (year, month, day) are parsed from a string and passed to `new Date(year, month, day)`, JavaScript automatically normalizes out-of-range dates (e.g., Feb 30th rolls over to Mar 2nd). Simply checking `isNaN()` is insufficient because the resulting date is valid, but represents a different semantic date than intended.

## Symptoms
- Formatting functions that convert string/date parameters to human-readable strings without checking `isNaN(date.getTime())` first.
- UI elements displaying `NaN-NaN-NaN` or similar corrupt placeholders.
- Silent semantic date shifts (e.g., a stored date of `"2026-02-30"` is displayed as `2026 年 3 月 2 日`) when parsing corrupted or manually edited persisted strings.

## Anti-Pattern Code Blocks
```javascript
// 1. Parsing date components without verifying rollover
function parseDateString(str) {
  const parts = str.split("-");
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const d = new Date(year, month, day);
  return isNaN(d.getTime()) ? null : d; // Returns March 2nd for "2026-02-30"
}

// 2. Formatting values directly without validating validity
function formatTimestamp(value) {
  if (!value) return "-";
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
```

## Remediation Code Blocks
```javascript
// 1. Validating components match to prevent automatic rollover
function parseDateString(str) {
  const parts = str.split("-");
  if (parts.length !== 3) return null;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const d = new Date(year, month, day);
  if (isNaN(d.getTime())) return null;
  
  // Verify components match exactly
  if (d.getFullYear() !== year || d.getMonth() !== month || d.getDate() !== day) {
    return null;
  }
  return d;
}

// 2. Safe formatting with NaN verification
function formatTimestamp(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (isNaN(date.getTime())) return "-";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
```

## Tags
`temporal`, `dates`, `validation`, `frontend`
