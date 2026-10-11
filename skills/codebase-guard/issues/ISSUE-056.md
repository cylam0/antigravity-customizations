# ISSUE-056: Omission of Parent/Context Configuration Lookups in Decoupled Entity Creation

## Description
When creating child or dependent entities that rely on configuration metadata stored on a parent/context record (such as polymorphic flags, duration rules, or structural types), failing to query the parent record up front in secondary or decoupled creation paths leads to basic default values being persisted. This bypasses the parent's configuration, leading to state inconsistencies (such as creating standard/full entities under a specialized/half-timeslot parent).

## Symptoms
- Child entities created through specific secondary actions (e.g., "open" or "extra" creation mutation endpoints) missing core type identifiers that match the parent's configuration.
- UI display discrepancies where records on the same parent unexpectedly fallback to different layout templates or default state properties.
- Divergent database column flags (e.g., `is_half` set to false under a course defined as `is_half_timeslot = true`).

## Anti-Pattern Code Blocks
```javascript
// Helper resolver creates child directly from input, bypassing parent configuration check
async function createChildEntity(parentId, studentId) {
  // Anti-pattern: Bypasses check on parent configuration, defaulting isSpecialized to false
  return await childSaver.insert({
    parentId,
    studentId,
    isSpecialized: false, 
    specializedIndex: null
  });
}
```

## Remediation Code Blocks
```javascript
// Query the parent configuration up front and propagate the properties to the child insert
async function createChildEntity(parentId, studentId) {
  const parentConfig = await parentLoader.load(parentId);
  if (!parentConfig) {
    throw new Error("Parent config not found");
  }
  const isSpecialized = parentConfig.isSpecializedConfig;

  return await childSaver.insert({
    parentId,
    studentId,
    isSpecialized,
    specializedIndex: isSpecialized ? 0 : null
  });
}
```

## Tags
`architecture`, `database`, `consistency`, `refactoring`
