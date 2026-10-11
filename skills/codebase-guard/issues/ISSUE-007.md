# ISSUE-007: Redundant Database Queries inside Computational Loops or Validation Routines

## Description
Executing queries to load static rules, configuration, or structural relationships inside nested loops or frequently called validation functions creates unnecessary database roundtrips. When these functions are executed repeatedly (for example, in multi-part runs or iterative loops), the query work scales linearly with the number of runs. Instead, callers should preload all necessary datasets once and pass them down as preloaded context/data parameters.

## Symptoms
- Validation or checking helper functions (`checkX`) making database queries internally.
- Calling database query methods (`loadRules`, `loadData`) inside iterative loops or multi-part processing functions.
- Re-fetching the same static datasets that are already available or fetched in the parent orchestration function.
- Re-querying records inside transaction loops (e.g. executing select queries by ID for each row in a collection of newly inserted rows) when the complete record objects were already returned by the insertion query.

## Anti-Pattern Code Blocks
```javascript
// 1. Helper function queries database directly on every invocation
async function checkRules(recordId, items) {
  const rules = await db.query("SELECT * FROM rules WHERE id = $1", [recordId]);
  // check rules on items...
}

async function processRecord(recordId, itemsGroupA, itemsGroupB) {
  // Both groups are processed independently, leading to duplicate queries
  await checkRules(recordId, itemsGroupA);
  await checkRules(recordId, itemsGroupB);
}
```

## Remediation Code Blocks
```javascript
// 1. Preload data in orchestration function and pass it down as optional context
async function checkRules(recordId, items, preloadedData = {}) {
  const rules = preloadedData.rules ?? await db.query("SELECT * FROM rules WHERE id = $1", [recordId]);
  // check rules on items...
}

async function processRecord(recordId, itemsGroupA, itemsGroupB) {
  const rules = await db.query("SELECT * FROM rules WHERE id = $1", [recordId]);
  await checkRules(recordId, itemsGroupA, { rules });
  await checkRules(recordId, itemsGroupB, { rules });
}
```

## Tags
`performance`, `database`, `caching`, `clean-code`
