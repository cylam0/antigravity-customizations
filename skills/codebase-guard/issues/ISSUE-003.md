# ISSUE-003: Hardcoded Temporal Boundaries and Fallbacks

## Description
Hardcoding temporal boundaries or static calendar years in source code to handle current or historical date comparisons. This creates a time-bomb or logical drift where the code behaves correctly during development but degrades or defaults incorrectly once calendar time progresses past the hardcoded cutoff.

## Symptoms
- A date utility or helper returning a static year value under a certain cutoff (e.g. returning `2026` if `year <= 2026`).
- Dropdown default selections resolving to future academic years for historical entries due to a hardcoded lower bound.
- Inability to correctly resolve time periods (such as academic years relative to a monthly cutoff) dynamically as the years progress.
- API requests, database queries, or GraphQL documents specifying static year/calendar constants for filtering or query boundaries instead of receiving them dynamically from UI/config state.

## Anti-Pattern Code Blocks
```javascript
export function getDefaultYear() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  
  // Anti-pattern: Hardcoding a static cutoff year
  if (year <= 2026) {
    return 2026;
  }
  return month < 6 ? year - 1 : year;
}
```

## Remediation Code Blocks
```javascript
export function getDefaultYear(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();
  
  // Remediation: Compute dynamically based on the target date/month cutoff
  return month < 6 ? year - 1 : year;
}
```

## Tags
`temporal`, `dates`, `architecture`
