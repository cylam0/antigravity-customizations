# ISSUE-062: SQL NOT IN Subquery Performance Pitfall

## Description
In SQL databases (specifically PostgreSQL), using a `NOT IN` predicate with a nested subquery can cause major performance degradation. By SQL standard specifications, if any row returned by the subquery contains a `NULL` value, the `NOT IN` evaluation returns `NULL` (unknown), which acts as a false condition. Because of this three-valued logic, the database engine cannot optimize the anti-join using a Hash or Merge join. Instead, it is forced to scan the subquery results iteratively for every single row in the outer table, resulting in an `O(M * N)` nested loop execution plan.

## Symptoms
- Table sync, cleanup, or delete queries taking excessive time or timeout errors.
- Unusually high CPU, disk read operations, and memory consumption during migrations.
- Execution plans showing nested loop anti-joins instead of hash/merge anti-joins.

## Anti-Pattern Code Blocks
```sql
DELETE FROM public.records
WHERE association_id NOT IN (
    SELECT id FROM public.associations
);
```

## Remediation Code Blocks
```sql
DELETE FROM public.records r
WHERE NOT EXISTS (
    SELECT 1 FROM public.associations a
    WHERE a.id = r.association_id
);
```

## Tags
`database`, `sql`, `performance`
