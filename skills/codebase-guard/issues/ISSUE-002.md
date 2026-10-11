# ISSUE-002: Unvalidated Type Conversion from Persistent State

## Description
Relying on type conversions (such as parsing integers using `parseInt` from localStorage, URL query parameters, or state managers) without verifying that the conversion succeeded and yielded a finite, valid number. Passing the result (which can be `NaN`) directly to strongly typed API payloads (e.g., GraphQL `Int!`) or database query arguments leads to runtime errors or validation crashes.

## Symptoms
- Using `parseInt(value, 10)` on a value loaded from user inputs, query parameters, or persistent storage (like `localStorage`), without checking `isNaN()` or `Number.isFinite()`.
- Passing unvalidated parsed numbers directly to GraphQL mutations or query variables that enforce strict non-nullable types (`Int!`).
- Corrupting local component state or triggering API payload rejection when an empty string, corrupted, or legacy value is retrieved from persistent storage.

## Anti-Pattern Code Blocks
```javascript
// 1. Unsafe conversion of storage/query values directly to API payload
const payloadValue = parseInt(localStorage.getItem("stored-key"), 10);
await executeMutation({ value: payloadValue }); // Fails if payloadValue is NaN

// 2. Direct usage of parsed state without fallback validation
const activeYear = parseInt(this.selectedYear, 10);
```

## Remediation Code Blocks
```javascript
// 1. Safe parsing with NaN verification and explicit fallback
let payloadValue = parseInt(localStorage.getItem("stored-key"), 10);
if (isNaN(payloadValue) || !Number.isFinite(payloadValue)) {
  payloadValue = DEFAULT_FALLBACK_VALUE;
}
await executeMutation({ value: payloadValue });

// 2. Safe parsing of local state variables
let activeYear = parseInt(this.selectedYear, 10);
if (isNaN(activeYear)) {
  activeYear = currentAcademicYear;
}
```

## Tags
`validation`, `frontend`, `state-management`
