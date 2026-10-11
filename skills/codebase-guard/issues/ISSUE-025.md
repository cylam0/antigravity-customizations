# ISSUE-025: Parameterizing SQL Utility Statements in Database Drivers

## Title
Parameterizing SQL Utility Statements in Database Drivers

## Description
SQL utility commands (such as `SET`, `SET LOCAL`, `ALTER`, or `CREATE`) cannot be parameterized in prepared statements in PostgreSQL. Database drivers that automatically parameterize variables (such as converting `${value}` into `$1`) will generate queries with syntax errors (e.g. `syntax error at or near "$1"`). When setting runtime session configurations dynamically, use built-in configuration functions (such as `set_config()`) instead of utility commands, as they behave like regular functions and can be parameterized safely.

## Symptoms
* Database query compilation failures returning `syntax error at or near "$1"` or equivalent parameter binding errors.
* Dynamic configuration variables failing to be applied at runtime in shared connection pools.

## Anti-Pattern
Attempting to parameterize configuration setting queries using utility statements:

```javascript
// Syntax Error: Utility statements cannot be parameterized
async function setThreshold(tx, threshold) {
  await tx`set local pg_trgm.word_similarity_threshold = ${threshold}`;
}
```

## Working Fix / Mitigation
Replace utility commands with regular function-style queries like `set_config` and convert arguments to text formats as expected by the database engine:

```javascript
// Safe: set_config is a function query and supports parameterized variables
async function setThreshold(tx, threshold) {
  await tx`select set_config('pg_trgm.word_similarity_threshold', ${threshold.toString()}, true)`;
}
```
