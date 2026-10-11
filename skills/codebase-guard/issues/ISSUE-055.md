# ISSUE-055: Reverse Tabnabbing Vulnerability via Unsecured Window Open Calls

## Title
Reverse Tabnabbing Vulnerability via Unsecured Window Open Calls

## Description
Using `window.open(url, "_blank")` or anchor tags with `target="_blank"` without specifying `noopener` or `noreferrer` security properties exposes the original window context (`window.opener`) to the newly opened page. If the opened page is compromised or malicious, it can access and modify `window.opener.location`, redirecting the parent tab to a phishing or malicious URL. To prevent this, always include `"noopener,noreferrer"` or `"noopener"` when opening external or new links.

## Symptoms
* Security audits identifying `window.open` calls targeting new tabs/windows without setting `noopener` or `noreferrer`.
* Parent tabs being silently redirected or hijacked when users click links pointing to a new tab/window.

## Anti-Pattern
Opening a new browser tab or window without securing the opener relationship:

```javascript
// Opening a new tab without blocking access to window.opener
const routeData = router.resolve({ path: "/target-view", query: { id } });
window.open(routeData.href, "_blank");
```

## Working Fix / Mitigation
Pass `"noopener,noreferrer"` as the third parameter to `window.open` to isolate the new browsing context:

```javascript
// Restricting access to window.opener using noopener,noreferrer
const routeData = router.resolve({ path: "/target-view", query: { id } });
window.open(routeData.href, "_blank", "noopener,noreferrer");
```
