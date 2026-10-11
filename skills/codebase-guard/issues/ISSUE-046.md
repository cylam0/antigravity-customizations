# ISSUE-046: Service Group-Update Logic Bypass in Secondary Mutations

## Description
Bypassing custom service-layer group updates in secondary or bulk mutation fields. When a state property (such as confirmation sent flags) needs to remain synchronized across all items in a student/parent group partition, updating the flag individually on a single row (via direct repository update calls) breaks the data consistency model.

## Symptoms
- Direct calls to single-row repository update methods from mutation endpoints modifying values that logically belong to a partition/group.
- State drift where one student's course checklist has a flag set to true but another course checklist for the same student has the flag set to false.

## Anti-Pattern Code Blocks
```javascript
// Mutation endpoint updates all flags for a single row, bypassing group sync
resolve: async (_root, { id, hasSentConfirmation, remarks }) => {
  await ChecklistRepository.updateFlags(id, { hasSentConfirmation, remarks });
}
```

## Remediation Code Blocks
```javascript
// Update individual flags and delegate group-level properties to service updates
resolve: async (_root, { id, hasSentConfirmation, remarks }) => {
  await sql.begin(async (tx) => {
    // 1. Update individual-level properties
    await ChecklistRepository.updateFlags(tx, id, { remarks });
    
    // 2. Delegate group-level property to the designated service method
    if (hasSentConfirmation !== undefined) {
      await ChecklistService.updateGroupConfirmation(tx, id, hasSentConfirmation);
    }
  });
}
```

## Tags
`architecture`, `database`, `consistency`
