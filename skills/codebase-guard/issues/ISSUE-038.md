# ISSUE-038: Unconstrained Range Bounds in Historical and Cycle Filters

## Description
Specifying open-ended SQL conditions (e.g. `>=`) for filtering domain values that represent fixed ranges or specific segments (such as academic cycles or terms). Omitting the upper limit allows newer cycles or future periods to be included, polluting datasets and triggering incorrect logic operations.

## Symptoms
- SQL filters specifying `column >= lower_bound` when the business requirement expects a range (e.g. `lower_bound` to `upper_bound`).

## Anti-Pattern Code Blocks
```javascript
export async function getHistoricalItems(year) {
  return sql`
    select * from records
    where year = ${year - 1}
      and cycle >= 7 -- Anti-pattern: missing upper bound (e.g. cycle <= 10)
  `;
}
```

## Remediation Code Blocks
```javascript
export async function getHistoricalItems(year) {
  return sql`
    select * from records
    where year = ${year - 1}
      and cycle >= 7
      and cycle <= 10 -- Remediation: enforce the upper boundary
  `;
}
```

## Tags
`database`, `sql`, `clean-code`
