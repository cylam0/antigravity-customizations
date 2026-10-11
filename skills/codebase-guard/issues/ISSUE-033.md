# ISSUE-033: Un-guarded Versioned API Queries Running in Incompatible Environments

## Description
When developing frontends that communicate with multi-version or rolling backend APIs (such as adding v2 endpoints alongside v1), query hooks targeting newer versions are often registered without checking if the newer endpoint is configured in the active environment. In environments where the endpoint is not available (e.g. legacy staging or local dev lacking configured variables), calling the client initialization throws an immediate unhandled runtime exception on mount. Queries must be guarded in their `enabled` block using availability flags.

## Symptoms
* Frontend crashes on load or shows blank screens with reference/initialization errors in environments where new API endpoints are disabled or unconfigured.
* Versioned queries execute automatically even when target backend versions are unavailable.
* Displaying misleading empty page layouts or allowing user actions (such as dialog triggers or mutation refetches) on features requiring unsupported API versions, instead of showing a "Feature Unavailable" container gate.

## Anti-Pattern Code Blocks
```javascript
// Query hook executes unconditionally, throwing an exception if v2 client initialization fails
export function useQueryData(params) {
  return useQuery({
    queryKey: ["myData", params],
    queryFn: async () => {
      const api = await useTutSysApi({ version: 2 });
      return api.request(GetDataQuery);
    },
    enabled: () => params.id != null
  });
}
```

## Remediation Code Blocks
```javascript
// Guard query execution using both parameter checks and version availability flags
export function useQueryData(params) {
  return useQuery({
    queryKey: ["myData", params],
    queryFn: async () => {
      const api = await useTutSysApi({ version: 2 });
      return api.request(GetDataQuery);
    },
    enabled: () => isTutSysApiV2Available && params.id != null
  });
}
```

## Tags
`frontend`, `api`, `graphql`, `clean-code`
