# ISSUE-052: Polymorphic Entity ID Collisions in Client-Side Cache and List Rendering

## Description
Failing to ensure unique identifiers for polymorphic or mixed-source GraphQL types that are served to the client can cause critical state conflicts. When a GraphQL type wraps objects compiled from multiple underlying database tables, their primary keys (which are often auto-incrementing integers) can easily overlap.

Because normalized client-side GraphQL caches (e.g., Apollo Client, URQL) and UI list/table components (e.g., component data tables using `data-key="id"`) rely on the `id` field as a unique key to track entity identities, colliding ID values will cause the client to corrupt its internal cache or misrender row selections and checkboxes.

## Symptoms
- Selecting a row or checkbox in a data table automatically highlights, checkmarks, or acts upon a completely different row.
- Normalized client-side caches overwrite properties of one item with the properties of another mixed-source item, leading to UI inconsistencies or stale data.

## Anti-Pattern Code Blocks
```javascript
// GraphQL resolver merging items from two different tables directly using database integer IDs
const itemsFromTableA = [{ id: 42, name: 'First Item' }];
const itemsFromTableB = [{ id: 42, title: 'Second Item' }];

const combinedList = [
  ...itemsFromTableA,
  ...itemsFromTableB
];

return combinedList.map((x) => ({
  id: x.id, // ID collision: both items have id = 42
  name: x.name || x.title
}));
```

## Remediation Code Blocks
```javascript
// Prefix the IDs in the resolver to guarantee uniqueness across different source tables
const itemsFromTableA = [{ id: 42, name: 'First Item' }];
const itemsFromTableB = [{ id: 42, title: 'Second Item' }];

const combinedList = [
  ...itemsFromTableA.map(x => ({ ...x, id: `source_a:${x.id}` })),
  ...itemsFromTableB.map(x => ({ ...x, id: `source_b:${x.id}` }))
];

return combinedList.map((x) => ({
  id: x.id, // Prefixed IDs like "source_a:42" and "source_b:42" do not collide
  name: x.name || x.title
}));
```

## Tags
`graphql`, `cache`, `state-management`, `polymorphism`
