# ISSUE-026: Accessing Private Library Properties Instead of Public API Methods

## Title
Accessing Private Library Properties Instead of Public API Methods

## Description
Accessing private or undocumented internal properties on third-party library objects (e.g. structures like `match.indexes` or properties prefixed with an underscore) is fragile. These properties can vary between minor versions or remain undocumented. Developers should always use the official public API methods provided by the library to extract data (e.g. calling `library.getIndexes(match)` instead of `match.indexes`), ensuring version compatibility and stability.

## Symptoms
* Subfeatures (like search result highlighting) silently failing (returning unhighlighted raw text) because the accessed property evaluates to `undefined` or has changed names.
* Code breaking or failing to type check after updating external node packages.

## Anti-Pattern
Relying on direct property access for internal library data:

```javascript
import fuzzysort from "fuzzysort";

// Fragile: match.indexes is not a public getter and returns undefined in many versions
function getMatchIndexes(match) {
  return match.indexes; 
}
```

## Working Fix / Mitigation
Utilize the library's public API functions to retrieve match indexes:

```javascript
import fuzzysort from "fuzzysort";

// Safe: Uses the official public API method provided by the library
function getMatchIndexes(match) {
  return fuzzysort.indexes(match);
}
```
