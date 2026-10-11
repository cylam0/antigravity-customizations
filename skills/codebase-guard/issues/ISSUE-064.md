# ISSUE-064: GraphQL Client Mutation Option Drift (Parameter Shifting)

## Description
When invoking mutation or query wrapper functions, passing parameters to incorrect positional argument positions (such as passing API configuration options as the third argument `context` instead of the fourth argument `options`) causes the option overrides to be silently ignored. This causes execution to fall back to the default API schemas/versions.

## Symptoms
- Mutation actions executed against older API versions/endpoints.
- Silent fallback to v1 schema despite explicitly passing `{ version: 2 }` in code.
- Mismatch between client expectation of versioned endpoints and actual HTTP traffic.

## Anti-Pattern Code Blocks
```javascript
// Signature: mutate(graphqlQuery, variables, context, options)
// Anti-pattern: Options object passed as the 3rd parameter (context)
await mutate(
  UpdateDataGraphql,
  payload,
  { version: 2 }
);
```

## Remediation Code Blocks
```javascript
// Remediation: Pass options as the 4th parameter, specifying undefined/null for context
await mutate(
  UpdateDataGraphql,
  payload,
  undefined,
  { version: 2 }
);
```

## Tags
`graphql`, `api`, `signature-drift`, `clean-code`
