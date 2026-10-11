# ISSUE-015: Strict Comparison Against Null Failing to Handle Undefined on Control Reset/Deselection

## Description
In client-side state management and UI component libraries, clearing or deselecting a control (such as a select dropdown, multi-select, or toggle button) often sets the underlying model variable to `undefined` (or sometimes `null`). When downstream logic or array filters utilize strict null checks (such as `!== null`) to check if the filter is active, they fail to catch `undefined` values. Consequently, the logic incorrectly treats the filter as active with a value of `undefined`, filtering out all valid data and resulting in empty datasets or runtime execution errors.

## Symptoms
- Deselecting a filter button or clearing a selection causes the entire grid, list, or dataset to become completely empty.
- Forms or search queries enter an invalid state after a reset operation, failing to show all available records.

## Anti-Pattern Code Blocks
```javascript
// Strict inequality checks fail to recognize when a filter becomes undefined upon deselection
if (selectedOption.value !== null) {
  records = records.filter((r) => r.type === selectedOption.value);
}
```

## Remediation Code Blocks
```javascript
// 1. Use loose inequality to check for both null and undefined
if (selectedOption.value != null) {
  records = records.filter((r) => (r.type ?? false) === selectedOption.value);
}

// 2. Or check explicitly for both null and undefined
if (selectedOption.value !== null && selectedOption.value !== undefined) {
  records = records.filter((r) => r.type === selectedOption.value);
}
```

## Tags
`javascript`, `null-safety`, `frontend`, `state-management`, `validation`
