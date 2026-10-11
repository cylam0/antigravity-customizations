# ISSUE-057: Global Registry Namespace Collision for Custom Library Extensions

## Description
Registering custom behaviors, formats, or matching functions under generic names in global UI/framework registries (such as PrimeVue's `FilterService`). Since registrations are global and persistent across the SPA session, components loaded later will override existing keys with different implementations. This leads to fragile, navigation-dependent bugs where behavior changes cross-page based on the order in which the user navigates.

## Symptoms
- Table filtering or data sorting on one page unexpectedly changes behavior or breaks after visiting a different page first.
- Intermittent filtering failures that cannot be replicated from a fresh page reload but occur reliably after a specific user navigation sequence.
- Global registry keys being silently overwritten with no console warning or error.

## Anti-Pattern Code Blocks
```javascript
// In Component A
FilterService.register("non_empty_remarks", (value, filter) => {
  return value !== null && value !== "";
});

// In Component B (loaded later, has different logic under the same key)
FilterService.register("non_empty_remarks", (value, filter) => {
  if (filter === "has") {
    return value !== null && String(value).trim() !== "";
  }
  return value === null || String(value).trim() === "";
});
```

## Remediation Code Blocks
```javascript
// In Component A - Use a view-specific unique suffix/prefix
FilterService.register("checklist_non_empty_remarks", (value, filter) => {
  return value !== null && value !== "";
});

// In Component B - Use a different unique namespace
FilterService.register("exam_non_empty_remarks", (value, filter) => {
  if (filter === "has") {
    return value !== null && String(value).trim() !== "";
  }
  return value === null || String(value).trim() === "";
});
```

## Tags
`frontend`, `clean-code`, `configuration`, `registry`
