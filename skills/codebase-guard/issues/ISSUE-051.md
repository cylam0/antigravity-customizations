# ISSUE-051: Logic Drift between Single-Record and Set-Based Batch Calculations

## Description
Divergent calculation outcomes and validation state drift between procedural single-record status updates and set-based batch SQL updates. When a status or property requires checking parent, calendar, or environmental contexts, single-record logic typically guards these checks using early returns or conditional blocks. If the corresponding batch update CTE or query does not replicate these conditional guards (e.g. checking context record presence before performing nested existence checks), the two methods will compute different results for the same database state.

## Symptoms
- Divergent status flags computed for the same record depending on whether they were updated individually or refreshed via a batch action.
- Batch SQL queries incorrectly evaluating nested relations (such as child existence checks) for records where the parent, cycle, or configuration boundary is absent or invalid, which the single-row code correctly ignores.

## Anti-Pattern Code Blocks
```javascript
// 1. Single-row method guards check behind parent/cycle existence
async function calculateStatusSingle(tx, record) {
  const cycle0 = await getCycle0(tx, record.year);
  let hasChildRelation = false;
  if (cycle0) {
    hasChildRelation = await checkRelationExists(tx, record.id, cycle0.id);
  }
  await updateRecord(tx, record.id, { hasChildRelation });
}

// 2. Anti-pattern batch query evaluates relation existence unconditionally
await sql`
  with relation_checks as (
    select
      r.id,
      exists(select 1 from child_records where parent_id = r.id) as has_relation
    from records r
  )
  update records r
  set has_child_relation = rc.has_relation
  from relation_checks rc
  where r.id = rc.id
`;
```

## Remediation Code Blocks
```javascript
// Remediation: enforce the parent/cycle existence condition inside the batch query CTE
await sql`
  with cycle_boundary as (
    select distinct on (year) year, id as cycle_id from cycles order by year, start_date asc
  ),
  relation_checks as (
    select
      r.id,
      (cb.cycle_id is not null and exists(
        select 1 from child_records where parent_id = r.id
      )) as has_relation
    from records r
    left join cycle_boundary cb on cb.year = r.year
  )
  update records r
  set has_child_relation = rc.has_relation
  from relation_checks rc
  where r.id = rc.id
`;
```

## Tags
`database`, `architecture`, `consistency`, `performance`
