# ISSUE-034: GraphQL Query Variable Type Mismatch From Raw UI Component Values

## Description
GraphQL engines enforce strict type checking for query variables. When UI components (such as dropdowns, input elements, or local storage rehydrators) bind and store selection states as raw strings, passing these variables directly to GraphQL query payloads that expect `Int` or `Float` types causes server-side variable validation exceptions (e.g., `Int cannot represent non-integer value: "2026"`). All variables bound to UI inputs must be explicitly coerced to the correct type (e.g. using `Number(val)`) in the query payload builder.

## Symptoms
* Query execution fails with server-side validation error: `Int cannot represent non-integer value: "..."`.
* Selecting dropdown items or restoring persistent filter selections results in silent API errors and empty UI lists.

## Anti-Pattern Code Blocks
```javascript
// Dropdown selection stored as a string "12" is passed directly to the query expecting an Int
const selectedItem = ref("12");

const queryParams = computed(() => ({
  itemId: selectedItem.value // Passes "12" (string) instead of 12 (number)
}));
```

## Remediation Code Blocks
```javascript
// Explicitly coerce string values to numbers in the query parameter builder
const selectedItem = ref("12");

const queryParams = computed(() => ({
  itemId: selectedItem.value !== "" ? Number(selectedItem.value) : null
}));
```

## Tags
`graphql`, `validation`, `frontend`, `clean-code`
