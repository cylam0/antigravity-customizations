# ISSUE-013: Unchecked Data Loader Queries for Null/Undefined Foreign Keys

## Description
Calling batch data loaders or model loaders with `null`, `undefined`, or empty identifiers within a loop, mapping, or batch operation without guards. If a database loader is called with a missing or invalid identifier, it can trigger database constraint/protocol exceptions, query failures, or unexpected null resolution errors that crash the entire business logic flow (e.g., in a `Promise.all` mapping loop).

## Symptoms
- A server-side transaction or mutation throws errors like `TypeError: Cannot read properties of undefined` or database protocol exceptions during batch operations.
- Resolvers calling data loader functions on optional or polymorphic foreign keys (e.g., resolving a relation where `foreign_key` is null).
- Business logic loops executing `Promise.all` over sub-collections or relations where some elements do not have a defined identifier.

## Anti-Pattern Code Blocks
```javascript
// 1. Model loader method calling a batch loader without guarding against null or undefined IDs
async getRecord({ recordLoader }) {
  return await recordLoader.load(this.recordId); // If this.recordId is null, load(null) runs and crashes
}

// 2. Batch resolution loop mapping all sub-items blindly without filtering out missing relation IDs
const subItems = await subitemLoader.loadByParent(parent.id);
const records = await Promise.all(
  subItems.map((item) => item.getRecord({ recordLoader }))
);
```

## Remediation Code Blocks
```javascript
// 1. Explicit guard in model/helper getters to return early if the relation ID is null/undefined
async getRecord({ recordLoader }) {
  if (this.recordId == null) {
    return null;
  }
  return await recordLoader.load(this.recordId);
}

// 2. Filter sub-items to only process those with a valid foreign key prior to loading
const subItems = await subitemLoader.loadByParent(parent.id);
const itemsWithRecord = subItems.filter((item) => item.recordId != null);
const records = await Promise.all(
  itemsWithRecord.map((item) => item.getRecord({ recordLoader }))
);
```

## Tags
`database`, `graphql`, `null-safety`, `clean-code`, `architecture`
