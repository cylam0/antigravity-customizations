# ISSUE-043: Duplicate and Divergent Database Update Helpers

## Description
Maintaining multiple independent database update functions in repository layers that modify overlapping sets of columns on the same database table. This duplication increases maintenance overhead, invites schema divergence when columns are added/removed, and leads to inconsistent query logic. Instead, specific update calls should be converted into wrappers that reuse a single, generalized update function, or removed if redundant.

## Symptoms
- Multiple repository methods (e.g., `updateStatus` and `updateFlexAndStatus`) constructing separate SQL update statements for the same table columns.
- Unused update helpers remaining in repository layers that duplicate more flexible dynamic update functions.

## Anti-Pattern Code Blocks
```javascript
// Helper 1: Specific update constructs separate SQL
export async function updateRecordStatus(sql, id, status) {
  return await sql`update items set status = ${status} where id = ${id}`;
}

// Helper 2: Overlapping helper also constructs separate SQL
export async function updateRecordDetails(sql, id, data) {
  return await sql`update items set status = ${data.status}, name = ${data.name} where id = ${id}`;
}
```

## Remediation Code Blocks
```javascript
// Generalized helper constructing dynamic updates
export async function updateRecordDetails(sql, id, data) {
  const updates = {};
  if (data.status !== undefined) updates.status = data.status;
  if (data.name !== undefined) updates.name = data.name;
  return await sql`update items set ${sql(updates)} where id = ${id}`;
}

// Specific helper implemented as a thin wrapper forwarding to the generalized helper
export async function updateRecordStatus(sql, id, status) {
  return updateRecordDetails(sql, id, { status });
}
```

## Tags
`database`, `refactoring`, `clean-code`
