# ISSUE-009: Failure to Propagate Invariant Entities to Mutation Lists in Swap/Optimization Phases

## Description
Automated optimization, resolution, or swap routines that reorganize assignments must respect explicit user locks or invariants. If the locked list is not merged with the fixed/immutable list during the swap/optimization phase, locked entities can be modified or relocated if they happen to violate other rules. To prevent this, all user-locked/restricted entity IDs must be explicitly merged into the list of immutable (fixed) IDs passed to the swapping or rearrangement engine.

## Symptoms
- Swap or optimization algorithms moving items that were explicitly locked/marked as fixed by the user.
- Passing an empty or incomplete list of fixed IDs to rearrangement algorithms despite having explicit locks in the context.
- Locked assignments being mutated or modified during subsequent conflict-resolution steps.

## Anti-Pattern Code Blocks
```javascript
// 1. Swap phase receives an empty fixedStudentIds array, ignoring explicit user locks
function autoFillAndSwap(items, lockedNames, lockedIds) {
  const assignments = initialFill(items, lockedNames, lockedIds);
  // Bug: Swap phase is called without passing the lockedIds as fixed,
  // so locked items can be swapped if they are part of violated set.
  return swapViolations(assignments, violatedIds, []);
}
```

## Remediation Code Blocks
```javascript
// 1. Merge locked/restricted IDs with explicit fixed IDs before execution
function autoFillAndSwap(items, lockedNames, lockedIds, fixedStudentIds = []) {
  const assignments = initialFill(items, lockedNames, lockedIds);
  const allFixedStudentIds = [
    ...fixedStudentIds,
    ...lockedIds.filter(id => id != null)
  ];
  // Safe: Locked IDs are passed to swapViolations to prevent mutability.
  return swapViolations(assignments, violatedIds, allFixedStudentIds);
}
```

## Tags
`business-logic`, `validation`, `constraints`
