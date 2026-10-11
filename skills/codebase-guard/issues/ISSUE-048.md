# ISSUE-048: Redundant Intermediate Recalculation in Sequential Transaction Steps

## Description
Performing costly status recalculations and database updates on a record in the middle of a transaction when subsequent steps in the same transaction will update the record again and recalculate its status anyway. This duplicates query work, causes redundant database write operations, and temporarily stores an incorrect/outdated intermediate status before overwriting it.

## Symptoms
- Sequential calls to status calculators or updater methods in a single mutation/transaction block.
- Duplicate database update operations (queries to update status) for the same record in logs or execution traces.

## Anti-Pattern Code Blocks
```javascript
// Status is calculated and written based on old flags, then immediately overwritten by group update
const success = await sql.begin(async (tx) => {
  await Repository.updateFlags(tx, id, newFlags);
  await Service.calculateAndStoreStatus(tx, id); // Redundant!

  if (hasGroupUpdate) {
    // updates target group and recalculates status for all records in the group
    await Service.updateGroupFlags(tx, id, groupFlags); 
  }
});
```

## Remediation Code Blocks
```javascript
// Conditionally skip intermediate calculation if subsequent steps will handle it
const success = await sql.begin(async (tx) => {
  await Repository.updateFlags(tx, id, newFlags);

  if (hasGroupUpdate) {
    // updates group and recalculates status for all records (including target id)
    await Service.updateGroupFlags(tx, id, groupFlags);
  } else {
    // only compute status if no group updates are triggered
    await Service.calculateAndStoreStatus(tx, id);
  }
});
```

## Tags
`performance`, `database`, `transactions`
