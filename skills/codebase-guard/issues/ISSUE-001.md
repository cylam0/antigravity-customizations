# ISSUE-001: Stringly-Typed Business Logic and Metadata Parsing from Display Names

## Description
Relying on parsing, pattern-matching, or extracting metadata from user-facing display string fields (like display names or titles) to drive core business logic, filtering, or entity categorization. This couples operational logic to visual representation formats and hardcodes static values in code.

## Symptoms
- Filtering entities by matching a year range prefix pattern from the display name instead of querying explicit entity metadata attributes.
- Determining entity sub-types or categories (such as tags or flags) by checking for case-insensitive substrings within display names.
- Excluding outdated or inactive records by hardcoding matches on name prefix/suffix prefixes (e.g., checking if name starts with specific past year sequences) instead of comparing against active date ranges or state variables.

## Anti-Pattern Code Blocks
```javascript
// 1. Filtering by parsing display name prefix
const currentItems = items.filter(item => /^[0-9]+-[0-9]+ - .*/g.test(item.name) === false);

// 2. Categorization from display name content
item.isSpecial = item.name.toUpperCase().includes("SPECIAL");

// 3. Excluding by hardcoded visual prefixes
const activeItems = items.filter(item => !item.name.startsWith("2023"));
```

## Remediation Code Blocks
```javascript
// 1. Filter using explicit attributes and dynamic contextual defaults
const currentItems = items.filter(item => item.year === currentYear);

// 2. Categorize using schema properties or attributes
item.isSpecial = item.type === "special";

// 3. Exclude dynamically using date/year bounds
const activeItems = items.filter(item => {
  const year = getYearFromDisplay(item.name, currentYear);
  return year >= currentYear - 2;
});
```

## Tags
`architecture`, `decoupling`, `clean-code`
