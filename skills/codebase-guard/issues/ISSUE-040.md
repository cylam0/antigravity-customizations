# ISSUE-040: API Schema Spelling and Casing Contracts Alignment

## Description
Introducing typos, misspellings, or inconsistent naming conventions in public-facing API schemas (such as GraphQL schemas, REST routes, or database columns). Because these schemas define client-facing contracts, they cannot be easily changed once released. Standardizing naming and resolving typos early prevents permanent legacy code clutter and reduces integration friction.

## Symptoms
- Spelling mistakes or casing inconsistencies in database columns (e.g. `has_marked_tutition`) or API field identifiers (e.g. `hasMarkedTutition`).

## Anti-Pattern Code Blocks
```graphql
type Item {
  id: ID!
  hasMarkedTutition: Boolean! # Anti-pattern: Spelling typo
}
```

## Remediation Code Blocks
```graphql
type Item {
  id: ID!
  hasMarkedTuition: Boolean! # Remediation: Correct spelling
}
```

## Tags
`graphql`, `api`, `refactoring`, `clean-code`
