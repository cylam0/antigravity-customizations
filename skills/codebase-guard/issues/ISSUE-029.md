# ISSUE-029: Correlated Subqueries in Bulk Database Operations

## Description
Using correlated subqueries (e.g. running a nested query block within the select statement that references the outer row's columns) inside bulk retrieval functions. For large lists of records, this causes $O(N)$ nested query execution inside the database engine, degrading to repeated index/table scans. Using a set-based `LEFT JOIN` combined with `GROUP BY` allows the query optimizer to perform a single unified join plan.

## Symptoms
- Bulk retrieval or mapping queries containing a nested `SELECT COUNT(*)` or other aggregation in the `SELECT` clause referencing outer table fields.
- Degrading performance and query execution times that scale linearly with the size of the bulk array input.

## Anti-Pattern Code Blocks
```sql
-- Nested correlated query inside SELECT clause executes COUNT(*) for every outer row
SELECT 
  t.id AS item_id,
  CASE 
    WHEN t.group_key IS NOT NULL THEN (
      SELECT COUNT(*)::int 
      FROM rules r
      WHERE r.group_key = t.group_key 
        AND r.created_at <= t.created_at
    )
    ELSE NULL 
  END AS computed_count
FROM target_items t
```

## Remediation Code Blocks
```sql
-- Set-based left join and group by allows a single scan/join plan
SELECT 
  t.id AS item_id,
  CASE 
    WHEN t.group_key IS NOT NULL THEN COUNT(r.id)::int 
    ELSE NULL 
  END AS computed_count
FROM target_items t
LEFT JOIN rules r ON r.group_key = t.group_key 
  AND r.created_at <= t.created_at
GROUP BY t.id, t.group_key
```

## Tags
`database`, `performance`, `sql`
