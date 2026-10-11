# ISSUE-008: Loss of Constraint Verification Context due to Flat-Array Index Collision in Combined Sub-Sessions

## Description
Combining multiple independent sub-session datasets (e.g. separate slots, halves, or categories) into a single flat array for constraint verification can lead to bugs. If any element has a non-unique lookup identifier (such as a device name assigned to different entities in different halves), standard lookup helpers like array.indexOf() will only return the first matching index. This causes verification rules to evaluate only one of the sub-sessions and ignore the others. Instead, verification routines should partition the combined dataset and run constraint checks independently for each sub-session, then combine the violations.

## Symptoms
- Checking rules on a flat array of assignments containing non-unique identifiers (like duplicate resource names).
- Using `indexOf` or index-based matching on resource lists where elements are expected to be unique, but may contain duplicates due to sub-session grouping.
- Validation checks executing correctly for only one portion of a merged dataset and silently omitting or ignoring conflicts in other portions.

## Anti-Pattern Code Blocks
```javascript
// 1. Array index lookup assumes unique device names in flat array
function checkNeighbors(resourceNames, assignedIds) {
  for (let i = 0; i < resourceNames.length; i++) {
    const neighbors = getNeighbors(resourceNames[i]);
    for (const n of neighbors) {
      const index = resourceNames.indexOf(n);
      // Bug: If 'n' appears multiple times (e.g., in different halves),
      // indexOf only returns the first occurrence, ignoring others.
      const assignedId = assignedIds[index];
      // check rules...
    }
  }
}
```

## Remediation Code Blocks
```javascript
// 1. Partition the checks per sub-session to guarantee uniqueness within each check run
function checkNeighbors(resourceNames, assignedIds, subSessionLookup) {
  const runChecks = (filteredNames, filteredIds) => {
    // check rules using unique list where indexOf works correctly
  };
  
  // Partition by sub-session
  const session1Names = [], session1Ids = [];
  const session2Names = [], session2Ids = [];
  for (let i = 0; i < resourceNames.length; i++) {
    const student = subSessionLookup[assignedIds[i]];
    if (student == null) continue;
    
    if (!student.isHalf || student.halfIndexNo === 0) {
      session1Names.push(resourceNames[i]);
      session1Ids.push(assignedIds[i]);
    }
    if (!student.isHalf || student.halfIndexNo === 1) {
      session2Names.push(resourceNames[i]);
      session2Ids.push(assignedIds[i]);
    }
  }
  
  return [
    ...runChecks(session1Names, session1Ids),
    ...runChecks(session2Names, session2Ids)
  ];
}
```

## Tags
`rule-engine`, `indexing`, `architecture`, `validation`
