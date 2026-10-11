# ISSUE-037: Weak Parent-Child Query Resolution on Domain Models

## Description
Resolving a parent's children collection in a GraphQL or relational resolver by filtering on generic shared attributes (such as `(year, type)`) rather than using the parent's unique surrogate/foreign key (`parent_id`). When multiple parent records share the same attributes, this returns children belonging to sibling parents, breaking data isolation and displaying incorrect relational data.

## Symptoms
- A resolver for a parent object querying children by filtering on properties from the parent model (e.g. `year = parent.year AND type = parent.type`) instead of `parent_id = parent.id`.

## Anti-Pattern Code Blocks
```javascript
export const parentResolver = {
  children: async (parent) => {
    // Anti-pattern: query by year/type instead of unique parent.id
    return await repository.findChildrenByYearAndType(parent.year, parent.type);
  }
};
```

## Remediation Code Blocks
```javascript
export const parentResolver = {
  children: async (parent) => {
    // Remediation: query strictly by the unique parent_id
    return await repository.findChildrenByParentId(parent.id);
  }
};
```

## Tags
`graphql`, `database`, `architecture`, `clean-code`
