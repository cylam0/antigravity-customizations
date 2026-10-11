# ISSUE-006: Insufficient Validation of Non-Nullable Integer Fields Before Serialization

## Description
Validating properties destined for non-nullable database columns (with `NOT NULL` constraints) using only a basic nullish check (e.g., `val == null`) allows non-numeric values like `NaN` to pass. Since `JSON.stringify` serializes `NaN` to `null`, this results in a database insert failure. Fields that represent database integers must be explicitly validated and coerced using type verification (e.g., checking if the parsed value is an integer) during model initialization.

## Symptoms
- Using simple nullish checks (`value == null`) for properties that are expected to be integers in the database.
- Passing `NaN` or invalid inputs to database savers that serialize inputs via JSON queries (e.g., database JSONB recordsets or stringified objects).
- Silent failure during serialization where `NaN` converts to `null`, violating `NOT NULL` database constraints.

## Anti-Pattern Code Blocks
```javascript
// 1. Weak nullish check that allows NaN to pass through
if (record.count == null) {
  throw new Error("count is required");
}
this.count = record.count;
```

## Remediation Code Blocks
```javascript
// 1. Explicit integer validation and coercion
if (record.count == null) {
  throw new Error("count is required");
}
const countParsed = Number(record.count);
if (!Number.isInteger(countParsed)) {
  throw new Error("count must be an integer");
}
this.count = countParsed;
```

## Tags
`validation`, `backend`, `database`, `serialization`
