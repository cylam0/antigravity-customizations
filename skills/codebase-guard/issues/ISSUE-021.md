# ISSUE-021: Positional Parameter Shifting and Signature Drift in Refactoring

## Description
When refactoring function signatures to remove or reorder parameters (especially positional parameters in dynamically typed languages like JavaScript), failing to locate and update all invocation sites leads to positional argument shifting. The remaining arguments are shifted into incorrect positions, causing parameters to receive incorrect values, unexpected types, or undefined values. This frequently occurs in test suites or secondary modules where arguments are passed positionally without explicit parameter validation.

## Symptoms
- Shifted values assigned to parameters (e.g. a number or index mapped to a boolean parameter).
- Silently broken tests or failed expectations because arguments passed to a function are bound to incorrect parameters.
- Discrepancy between actual function definitions and test invocation call sites.

## Anti-Pattern Code Blocks
```javascript
// Anti-pattern: Function signature after refactoring (removed second parameter 'obsoleteFlag')
function processItem(id, options, callback) {
  // logic...
}

// Invoking using the old signature with the removed argument
processItem(itemId, obsoleteFlag, itemOptions, itemCallback);
// Results in:
// - 'options' parameter receives the value of 'obsoleteFlag' (boolean)
// - 'callback' parameter receives the value of 'itemOptions' (object)
// - 'itemCallback' is ignored or lost
```

## Remediation Code Blocks
```javascript
// Remediation: Update all call sites to match the new positional parameter list
processItem(itemId, itemOptions, itemCallback);
```

## Tags
`refactoring`, `clean-code`, `signature-drift`, `testing`
