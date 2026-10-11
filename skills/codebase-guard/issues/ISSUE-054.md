# ISSUE-054: Omission of Soft-Deletion Filters in Batch Container Selection Queries

## Description
When selecting a set of child records belonging to a parent container (e.g., fetching all lessons belonging to a timeslot or all students belonging to a course) for calculations, syncs, or batch status updates, omitting the soft-deletion filter (e.g., `is_deleted = false`) is a major vulnerability. 

If soft-deleted/historical records are selected, they will pollute container calculations, trigger incorrect status evaluations (such as flagging updated prints/changes for deleted items), and cause performance drag or database constraint violations when running batch mutations.

## Symptoms
- Stale or soft-deleted records appearing in bulk downloads, statistics, or reports.
- Container state recalculations yielding incorrect results (e.g., registering changes for items that are no longer active).
- Batch updates modifying deleted entities, which can trigger cascade violations or overwrite other valid records.

## Anti-Pattern Code Blocks
```sql
-- Selecting container lessons without filtering out soft-deleted ones
SELECT id FROM public.lessons
WHERE container_id = $1 AND status IS NULL;
```

```javascript
// Service method executing calculations on all active and soft-deleted lessons in a group
const lessons = await db.query(
  "SELECT id FROM lessons WHERE container_id = $1",
  [containerId]
);
```

## Remediation Code Blocks
```sql
-- Explicitly exclude soft-deleted records using is_deleted filter
SELECT id FROM public.lessons
WHERE container_id = $1 AND status IS NULL AND is_deleted = false;
```

```javascript
// Exclude soft-deleted lessons in query execution
const lessons = await db.query(
  "SELECT id FROM lessons WHERE container_id = $1 AND is_deleted = false",
  [containerId]
);
```

## Tags
`database`, `sql`, `soft-delete`, `consistency`
