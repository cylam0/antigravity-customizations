# ISSUE-024: GraphQL Query Variable Null-Coercion Overriding Server Defaults

## Title
GraphQL Query Variable Null-Coercion Overriding Server Defaults

## Description
In GraphQL, there is a semantic difference between an omitted variable (which defaults to the schema default value) and a variable explicitly passed as `null`. When a client destructures variables and coerces them (e.g., using `?? null`) to avoid undefined properties, it sends `null` values over the network. This forces the GraphQL execution engine to bypass server-side default argument values, potentially breaking business logic. Client-side stores must build variables dynamically and omit undefined keys.

## Symptoms
* Query execution resolving arguments to `null` instead of their schema defaults (e.g., fallback thresholds resolving to `null` instead of `0.6`, matching everything or nothing).
* Hard-to-trace backend query differences between direct playground testing (where variables are omitted) and actual app runtime (where variables are sent as `null`).

## Anti-Pattern
Coercing destructured or undefined parameters to `null` inside the query variables payload:

```javascript
// Bypasses schema defaults by passing explicit nulls
export async function searchItems({ keyword, threshold }) {
  const result = await query(SearchItemsGraphql, {
    keyword: keyword || null,
    threshold: threshold ?? null // COERCION: Overrides server schema defaults to null
  });
  return result;
}
```

## Working Fix / Mitigation
Build the variables object dynamically, only assigning keys if their values are not `undefined`:

```javascript
export async function searchItems({ keyword, threshold }) {
  const variables = {
    keyword: keyword || null
  };

  // Only assign variables if they are explicitly provided
  if (threshold !== undefined) {
    variables.threshold = threshold;
  }

  const result = await query(SearchItemsGraphql, variables);
  return result;
}
```
