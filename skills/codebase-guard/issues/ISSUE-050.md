# ISSUE-050: Unhandled Promise Rejections and Missing User Feedback in Asynchronous UI Container Actions

## Description
Failing to catch exceptions in asynchronous UI controller or container event handlers that wrap service layer or API client calls. Because async calls like HTTP requests or GraphQL mutations can fail due to network drops, authentication timeouts, or validation errors, leaving the calls un-guarded inside the component layer leads to unhandled promise rejections. In addition, the frontend lacks try-catch wrapper logic to intercept the exception, leaving the user with a frozen state and no visual feedback (such as a failure toast message).

## Symptoms
- Action buttons remain in loading states or do not dismiss, but no error message or toast is displayed to the user.
- Console logs throwing `Unhandled Promise Rejection` or `Uncaught (in promise) Error` on network failures or server exceptions.

## Anti-Pattern Code Blocks
```javascript
// Anti-pattern: Async API call is not guarded, exposing raw promise rejections to the runtime
async function onConfirmAction(data) {
  const result = await apiService.update(data);
  if (result.success) {
    showToast("Success");
  } else {
    showToast("Failed: " + result.message);
  }
}
```

## Remediation Code Blocks
```javascript
// Remediation: Wrap async operation in try-catch and notify the user on failure
async function onConfirmAction(data) {
  try {
    const result = await apiService.update(data);
    if (result.success) {
      showToast("Success");
    } else {
      showToast("Failed: " + result.message);
    }
  } catch (error) {
    showToast("Error: " + (error?.message || "An unexpected error occurred."));
  }
}
```

## Tags
`frontend`, `api`, `validation`, `user-experience`
