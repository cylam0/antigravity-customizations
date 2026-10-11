# ISSUE-020: Explicit Database Dependency on Deprecated Columns under Schema Retirement

## Description
When a database column is being retired or deprecated but still exists in the database schema, application code (specifically SQL INSERT and UPDATE statements) should be updated to omit referencing or writing to that column. Continuing to explicitly insert values (even hardcoded default values) into deprecated columns creates a brittle dependency. When the column is eventually dropped from the database schema, all such queries will instantly fail with runtime exceptions. Instead, database defaults should be relied upon, and code-level references should be dropped immediately.

## Symptoms
- SQL statements in models, repositories, or services explicitly reference or insert values into a database column that is planned for removal.
- Test seeds or test helper queries explicitly write values into deprecated database columns instead of letting database defaults handle the field value.
- Post-migration query execution errors (e.g. column does not exist) after a database migration drops the deprecated column.

## Anti-Pattern Code Blocks
```sql
-- Anti-pattern: Explicitly inserting a value into a deprecated column in application queries
INSERT INTO items (name, description, is_deprecated_flag)
VALUES ($1, $2, false);
```
```sql
-- Anti-pattern: Seeding database with a deprecated column in tests
INSERT INTO items (id, name, is_deprecated_flag)
VALUES (1, 'Test Item', false);
```

## Remediation Code Blocks
```sql
-- Remediation: Omit the deprecated column from the INSERT statement to rely on DB defaults
INSERT INTO items (name, description)
VALUES ($1, $2);
```
```sql
-- Remediation: Let the database default handle the deprecated column in test seeds
INSERT INTO items (id, name)
VALUES (1, 'Test Item');
```

## Tags
`database`, `sql`, `schema-evolution`, `refactoring`
