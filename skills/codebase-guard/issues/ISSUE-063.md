# ISSUE-063: GraphQL Resolver N+1 Pattern (Missing DataLoader or Loadable Fields)

## Description
Fetching related objects or calculating aggregate values inside individual GraphQL field resolvers results in the N+1 query problem. For each entity resolved in the parent list (1 query), the field resolver executes an additional, isolated database query (N queries). This increases the database roundtrip overhead and response latency dramatically when querying lists of records. Instead, fields should use batch-loaders (`t.loadable`, DataLoader, or pre-fetched in-memory lookups) to aggregate queries.

## Symptoms
- Multiple near-identical database queries executed sequentially during a single GraphQL query run.
- Response latency scales linearly with the size of the returned collection.
- Field resolvers executing raw database query commands using item/record properties.

## Anti-Pattern Code Blocks
```typescript
builder.objectField(ItemRef, "statusName", (t) =>
  t.string({
    resolve: async (item) => {
      const [status] = await db.query("SELECT * FROM statuses WHERE id = $1", [item.statusId]);
      return status?.name ?? "Unknown";
    }
  })
);
```

## Remediation Code Blocks
```typescript
builder.objectField(ItemRef, "statusName", (t) =>
  t.loadable({
    type: "String",
    load: async (items) => {
      const statusIds = [...new Set(items.map((i) => i.statusId))];
      const statuses = await db.query("SELECT * FROM statuses WHERE id = any($1)", [statusIds]);
      const statusMap = new Map(statuses.map((s) => [s.id, s.name]));
      return items.map((i) => statusMap.get(i.statusId) ?? "Unknown");
    },
    resolve: (item) => item
  })
);
```

## Tags
`graphql`, `performance`, `database`, `dataloader`
