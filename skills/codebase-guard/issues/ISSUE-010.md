# ISSUE-010: Inefficient Array Deep-Cloning of Primitive Types via JSON Serialization

## Description
Using JSON serialization (JSON.parse(JSON.stringify(array))) to clone a flat array of primitive values (numbers, strings, booleans, null, or undefined) is highly inefficient and creates unnecessary CPU and memory overhead. Additionally, JSON stringification coerces any undefined values in the array to null, which can alter the types and semantics of elements in the array. Flat primitive arrays should always be shallow-cloned using standard operators like the spread operator ([...arr]) or slice().

## Symptoms
- Cloning simple arrays of primitive types using `JSON.parse(JSON.stringify(array))`.
- Type conversion side-effects where `undefined` elements in the cloned array become `null`.
- Poor performance in data-intensive loops due to JSON serialization overhead.

## Anti-Pattern Code Blocks
```javascript
// 1. Cloning flat array via JSON serialization
const newArray = JSON.parse(JSON.stringify(primitiveArray));
```

## Remediation Code Blocks
```javascript
// 1. Shallow cloning via spread operator (preserves undefined, extremely fast)
const newArray = [...primitiveArray];
```

## Tags
`performance`, `types`, `serialization`
