# ISSUE-012: Incomplete GraphQL Mutation Payload causing Cache Overwrite and State Regression

## Description
When updating entities in a client-side state manager or normalized cache using the payload returned by a GraphQL mutation, the returned object replaces the existing cached object. If the mutation query asks for only a subset of fields (e.g., just `id` and one updated status field) compared to the initial query that populated the page/component, the cached entity will be overwritten with the partial object. This drops all other previously fetched fields from the local cache, leading to immediate UI data loss, broken column renders, or lost status indicator badges.

## Symptoms
- A UI component or table row displays details correctly on load, but several column values or status indicators (e.g., names, dates, custom tags) suddenly disappear or revert to blank/default states right after executing an action/mutation that updates the item.
- Mutation GraphQL document payloads requesting only minimal properties (like `id` and status) for a complex entity that is bound to a detailed table or view.
- Client state store methods (like a local database splice or set) merging mutation results by completely replacing the store's entity instances instead of deep-merging them field-by-field.

## Anti-Pattern Code Blocks
```graphql
# 1. Mutation requesting minimal fields on an object that is fully rendered in a table
mutation UpdateItemStatus($id: ID!, $status: String!) {
  updateItemStatus(id: $id, status: $status) {
    success
    message
    item {
      id
      status # Missing core fields like name, dateDesc, and group!
    }
  }
}
```
```javascript
// 2. Client-side store replaces the cached object completely with the partial payload
function setItem(updatedItem) {
  const index = state.items.findIndex(x => x.id === updatedItem.id);
  if (index !== -1) {
    state.items[index] = updatedItem; // Drops name/dateDesc because updatedItem only has id/status!
  }
}
```

## Remediation Code Blocks
```graphql
# 1. Query the full set of fields inside the mutation response that the view depends on
mutation UpdateItemStatus($id: ID!, $status: String!) {
  updateItemStatus(id: $id, status: $status) {
    success
    message
    item {
      id
      status
      name
      dateDesc
      group {
        id
        name
      }
    }
  }
}
```
```javascript
// 2. Safely deep-merge or property-assign instead of replacing the entire object
function setItem(updatedItem) {
  const index = state.items.findIndex(x => x.id === updatedItem.id);
  if (index !== -1) {
    state.items[index] = {
      ...state.items[index],
      ...updatedItem
    };
  }
}
```

## Tags
`graphql`, `cache`, `state-management`, `api`
