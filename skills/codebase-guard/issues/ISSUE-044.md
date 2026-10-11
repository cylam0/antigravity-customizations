# ISSUE-044: Database Enum Type Mismatch on Array Queries

## Description
Passing a dynamically generated text array into an `ANY()` or `IN` operator comparing against an `enum` column in SQL queries. If the array contains any string values that do not correspond to valid enum values (e.g., custom user-entered strings or unrelated category values), PostgreSQL throws an invalid input value/casting error instead of executing the query successfully and returning no matches for those items.

## Symptoms
- SQL template queries comparing a database `enum` column with a parameter of type `text[]` or `varchar[]`.
- Database error `invalid input value for enum [enum_name]: "[value]"` when querying entities containing custom or non-standard subject/label strings.

## Anti-Pattern Code Blocks
```javascript
// Dynamic array derived from text column contains custom/unsupported values
const subjects = ['core', 'custom-subject'];

const rows = await sql`
  select * from tuitionfees 
  where subject = any(${subjects})
`;
```

## Remediation Code Blocks
```javascript
// Option 1: Pre-filter in the application layer using a whitelist of allowed enum values
const ALLOWED_SUBJECTS = ['core', 'm1', 'm2'];
const subjects = ['core', 'custom-subject'].filter(s => ALLOWED_SUBJECTS.includes(s));

const rows = await sql`
  select * from tuitionfees 
  where subject = any(${subjects})
`;

// Option 2: Cast the enum column to text in the query to match text arrays safely
const rows = await sql`
  select * from tuitionfees 
  where subject::text = any(${subjects})
`;
```

## Tags
`database`, `sql`, `type-safety`
