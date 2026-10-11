# ISSUE-039: Nullable Argument Leakage for Database NOT NULL Columns

## Description
Allowing `null` values in TypeScript types or API inputs for fields that map to non-nullable database columns. This creates a type safety gap where the compiler allows compiling code that passes `null`, resulting in database constraint violations (`NOT NULL violation`) at runtime.

## Symptoms
- A repository method signature or API handler typing helper properties as `type | null` when the corresponding database column has a `NOT NULL` constraint.

## Anti-Pattern Code Blocks
```typescript
export async function updateRecordStatus(
  id: number,
  data: {
    status?: RecordStatus | null; // Anti-pattern: database column is NOT NULL
  }
) {
  // Can attempt to write NULL to status if null is passed
}
```

## Remediation Code Blocks
```typescript
export async function updateRecordStatus(
  id: number,
  data: {
    status?: RecordStatus; // Remediation: status can be omitted (undefined) but not null
  }
) {
  // Safe from writing NULL values
}
```

## Tags
`database`, `typescript`, `validation`
