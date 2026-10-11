# ISSUE-053: Ignoring Success/Failure Status Flags in Asynchronous API Response Wrappers

## Description
When asynchronous API actions or mutation helpers wrap errors internally to return a unified wrapper object (e.g., returning `{ success: boolean, message: string }` instead of throwing a raw Promise rejection), calling code must explicitly inspect the returned status indicator. 

If calling code ignores the wrapper's `success` status, it will blindly proceed to subsequent downstream logic (such as triggering file downloads, starting generation tasks, or showing success messages), even though the backend operation actually failed.

## Symptoms
- UI displays a success toast or alert while the backend records a failure or throws an error.
- Downstream actions (such as downloading/processing files) proceed with stale, empty, or corrupted data.
- Stale or invalid client state continues execution without showing error feedback to the user.

## Anti-Pattern Code Blocks
```javascript
// Calling a status-update mutation that wraps errors without checking its return status
async function handleAction() {
  try {
    await updateItemStatusMutation({ id: itemId });
    
    // Blindly proceeds to download files and trigger success toasts
    const file = await downloadFile(itemId);
    showSuccessToast("Action completed");
  } catch (e) {
    // This catch block is never reached because the helper catches and wraps errors
    showErrorToast(e.message);
  }
}
```

## Remediation Code Blocks
```javascript
// Explicitly check the success flag and raise/handle failures accordingly
async function handleAction() {
  try {
    const result = await updateItemStatusMutation({ id: itemId });
    if (!result?.success) {
      throw new Error(result?.message || "Failed to update item status");
    }
    
    const file = await downloadFile(itemId);
    showSuccessToast("Action completed");
  } catch (e) {
    showErrorToast(e.message);
  }
}
```

## Tags
`frontend`, `api`, `error-handling`, `clean-code`
