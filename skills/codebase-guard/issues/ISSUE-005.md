# ISSUE-005: GraphQL Schema and Query Type Drift

## Description
Failing to align client-side GraphQL queries and frontend data filtering logic with updated backend schemas (e.g., when fields are renamed or deprecated, such as changing a boolean property from `isHidden` to `isActive`). This leads to silent logic failures, empty arrays, or runtime exceptions because the client query requests a field that no longer exists or returns undefined data.

## Symptoms
- Querying a deprecated or renamed field (e.g. requesting `isHidden`) which causes GraphQL query validation errors or returns `null`/`undefined`.
- Filtering frontend UI lists against deprecated properties (e.g. `room.isHidden === false`) when the new schema standard uses a different semantic direction (e.g. `room.isActive === true`).
- Discrepancy between code-generated TypeScript typings (which reflect the new schema) and static GraphQL query documents in the repository.

## Anti-Pattern Code Blocks
```graphql
# Anti-pattern: Requesting a field renamed/removed in the backend
query LoadData {
  records {
    id
    name
    isHidden
  }
}
```
```javascript
// Anti-pattern: Filtering with legacy field
const activeRecords = records.filter(x => x.isHidden === false);
```

## Remediation Code Blocks
```graphql
# Remediation: Request the updated field name
query LoadData {
  records {
    id
    name
    isActive
  }
}
```
```javascript
// Remediation: Filter with updated schema field
const activeRecords = records.filter(x => x.isActive === true);
```

## Tags
`graphql`, `schema-drift`, `api`
