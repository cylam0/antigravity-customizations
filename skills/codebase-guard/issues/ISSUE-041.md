# ISSUE-041: Redundant API Refetching on Dialog Cancellation

## Description
Unconditionally triggering an API refetch or data refresh when a modal/dialog closes, regardless of whether the user completed the action (e.g. created/updated an entity) or cancelled/dismissed the dialog. This generates unnecessary network overhead and can lead to unhandled errors or console warnings, especially if the query hook is currently disabled or in an error state.

## Symptoms
- A function that awaits a dialog promise and immediately calls `refetch()` without verifying if a truthy response or payload was returned.

## Anti-Pattern Code Blocks
```javascript
async function handleOpenDialog() {
  await dialogStore.open(MyDialog);
  refetchData(); // Anti-pattern: runs even if user cancels the dialog
}
```

## Remediation Code Blocks
```javascript
async function handleOpenDialog() {
  const result = await dialogStore.open(MyDialog);
  if (result) {
    refetchData(); // Remediation: only refetch if the action succeeded/returned a result
  }
}
```

## Tags
`frontend`, `performance`, `clean-code`
