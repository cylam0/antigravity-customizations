# ISSUE-011: Polymorphic Association Nullability and Brittle Display-String Parsing

## Description
Failing to account for nullability in polymorphic or mutually exclusive association fields where an entity relates to one of multiple optional types (e.g., either `associationA` or `associationB`). Accessing nested properties on these optional associations without safe navigation, unified fallbacks, or requesting the required sub-fields in GraphQL queries leads to runtime exceptions. 

Additionally, parsing metadata from concatenated display-string fields using fixed substring offsets (e.g., `substring(10, 20)`) is highly fragile. It crashes or drops metadata when different entity sub-types with variable-length names are introduced.

## Symptoms
- Reading a nested property on a nullable association object (e.g., `item.association.name`) where the association resolves to `null` for certain polymorphic sub-types.
- Missing sub-fields in client-side GraphQL queries for a polymorphic association, resulting in client-side undefined fields during render.
- Failing to sort list items properly because the table sort field points directly to a nested property of a nullable association (e.g. `association.startTime`) instead of a computed unified property.
- Extracting metadata from formatted display strings using hardcoded start/end index positions rather than structured attributes or dynamic delimiter splitting.
- Gating conditional layout rendering or UI branches on the presence of optional/nullable polymorphic detail objects (e.g. `isAlternativeState && alternativeDetails`) instead of the core state flag. This causes the UI to incorrectly fall back to the default branch when the detail object is null/missing.

## Anti-Pattern Code Blocks
```graphql
# 1. Missing sub-fields in query for polymorphic alternative
query LoadItems {
  items {
    id
    associationA {
      id
      name
      startTime
      room { name }
    }
    associationB {
      id
      name # Missing room and startTime sub-fields!
    }
  }
}
```
```javascript
// 2. Unsafe nested property access and hardcoded substring slicing
function renderReminder(item) {
  const dateStr = item.associationA.name.substring(0, 10);
  const timeStr = item.associationA.name.substring(11, 20);
  const roomName = item.associationA.room.name;
  return `Reminder: ${dateStr} at ${timeStr} in ${roomName}`;
}

// 3. Sorting by a nullable nested field directly
const sortField = "associationA.startTime";

// 4. Gating conditional layout on optional detail object instead of state flag
const templateAntiPattern = `
<div v-if="item.isAlternativeState && item.alternativeDetails">
  <span>{{ item.alternativeDetails.name }}</span>
</div>
<div v-else>
  <span>{{ item.defaultDetails.name }}</span>
</div>
`;
```

## Remediation Code Blocks
```graphql
# 1. Fetch complete fields for all polymorphic alternatives
query LoadItems {
  items {
    id
    isPolymorphicAlternative
    associationA {
      id
      name
      startTime
      room { name }
    }
    associationB {
      id
      name
      startTime
      room { name }
    }
  }
}
```
```javascript
// 2. Polymorphic fallback resolution, safe access, and dynamic splitting
function renderReminder(item) {
  const assoc = item.isPolymorphicAlternative ? item.associationB : item.associationA;
  const displayName = assoc?.name;
  const roomName = assoc?.room?.name;

  if (!displayName) return "";

  // Use dynamic split rather than hardcoded substrings
  const parts = displayName.split(" ");
  const dateStr = parts[0] || "";
  const timeStr = parts[1] || "";

  return `Reminder: ${dateStr} at ${timeStr} in ${roomName || ""}`;
}

// 3. Sorting by a normalized computed property
items.forEach(item => {
  if (item.isPolymorphicAlternative && item.associationB) {
    item.normalizedStartTime = item.associationB.startTime;
  } else if (item.associationA) {
    item.normalizedStartTime = item.associationA.startTime;
  } else {
    item.normalizedStartTime = null;
  }
});
const sortField = "normalizedStartTime";

// 4. Branch on the state flag first, and handle optional details with safe navigation/fallback
const templateRemediation = `
<div v-if="item.isAlternativeState">
  <span>{{ item.alternativeDetails ? item.alternativeDetails.name : "-" }}</span>
</div>
<div v-else>
  <span>{{ item.defaultDetails?.name || "-" }}</span>
</div>
`;
```

## Tags
`graphql`, `polymorphism`, `null-safety`, `clean-code`
