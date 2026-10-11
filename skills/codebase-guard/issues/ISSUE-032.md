# ISSUE-032: Non-Deterministic Database Query Results Due to Missing ORDER BY or Unique Tie-Breakers

## Description
Relational databases (like PostgreSQL) do not guarantee row order when returning query results unless an explicit `ORDER BY` clause is specified. Returning unordered list results leads to non-deterministic API responses, breaking frontend expectations, rendering orders, test assertions, and client-side caches.
Furthermore, when using operators like `DISTINCT ON`, PostgreSQL requires an `ORDER BY` that matches the grouping columns. If multiple rows share the same values for the sort columns (e.g., multiple updates with identical timestamps), the chosen row becomes non-deterministic unless a unique tie-breaker (such as `id DESC`) is appended to the sorting list.

## Symptoms
* API client lists or dropdowns display in different, random orders between refreshes or calls.
* Client-side stores or caching layers fail to identify changes because elements swap positions silently.
* `DISTINCT ON` views or subqueries occasionally select different rows for the same entity after manual data updates or bulk inserts.

## Anti-Pattern Code Blocks
```sql
-- 1. DISTINCT ON sorting without a deterministic tie-breaker (e.g., when two rows share the same update_time)
SELECT DISTINCT ON (year, cycle_number, form, subject) year, cycle_number, form, subject, fee_per_cycle
FROM tuitionfees
ORDER BY year, cycle_number, form, subject, update_time DESC;

-- 2. Fetching list records in a repository query without an ORDER BY clause
SELECT * FROM latest_tuitionfees WHERE year = 2026;
```

## Remediation Code Blocks
```sql
-- 1. Appending a unique ID column (e.g., id DESC) to guarantee deterministic tie-breaking
SELECT DISTINCT ON (year, cycle_number, form, subject) year, cycle_number, form, subject, fee_per_cycle
FROM tuitionfees
ORDER BY year, cycle_number, form, subject, update_time DESC, id DESC;

-- 2. Specifying a stable ORDER BY clause for list repository calls
SELECT * FROM latest_tuitionfees WHERE year = 2026 ORDER BY form, subject;
```

## Tags
`database`, `sql`, `clean-code`, `architecture`
