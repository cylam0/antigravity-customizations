# ISSUE-027: Case-Sensitive Trigram Matches Bypassing GIN Indexes

## Title
Case-Sensitive Trigram Matches Bypassing GIN Indexes

## Description
In PostgreSQL's `pg_trgm` extension, trigrams are case-sensitive (e.g. `Spr` and `spr` produce different trigrams). Naive trigram searches on mixed-case columns can either miss matches due to casing differences or cause slow query performance. Using column-modifying functions (such as `coalesce` or `lower`) in queries against standard column indexes prevents the database query planner from scanning those indexes, resulting in full table scans. For case-insensitive trigram matching, you must define functional GIN indexes using `lower(column)` and write matches in the query against `lower(column)` directly.

## Symptoms
* Case-insensitive keyword searches missing valid matches (e.g. searching for lowercase "sprint" fails to match "Sprint").
* Slow database performance and high CPU utilization on search queries due to sequential table scans.
* EXPLAIN analyze plans showing `Seq Scan` instead of `Bitmap Index Scan` on GIN indexes.

## Anti-Pattern
Applying case-insensitive string modifications directly in queries against standard GIN column indexes, or using case-sensitive matches:

```sql
-- Index defined on name:
-- CREATE INDEX name_trgm_idx ON items USING gin (name gin_trgm_ops);

-- Query: Bypasses the index because of lower() column wrapping
SELECT * FROM items WHERE 'sprint' <% lower(name);

-- OR: Misses matches because of case-sensitivity
SELECT * FROM items WHERE 'sprint' <% name;
```

## Working Fix / Mitigation
Create functional GIN indexes on the lowercased column values, and match against `lower(column)` inside the query:

```sql
-- Create functional index
CREATE INDEX items_name_lower_trgm_idx ON items USING gin (lower(name) gin_trgm_ops);

-- Query: Postgres successfully utilizes the functional GIN index
SELECT * FROM items WHERE 'sprint' <% lower(name);
```
