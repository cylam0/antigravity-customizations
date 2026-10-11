# ISSUE-028: Model-Mapping and Serialization Drift During Database Schema Evolution

## Description
When database schemas are extended with new columns or computed properties, and these properties are utilized in business logic, name generation, or API serializers/resolvers, developers often forget to update the data access layer (such as constructors, model property definitions, and factory conversion layers). This leads to properties being silently `undefined` or `null` at runtime, causing downstream logic, GraphQL resolvers, or UI rendering to fail.

## Symptoms
- Properties or columns newly added to the database tables resolve to `undefined` or `null` on model instances.
- Resolvers or business logic referencing the properties fail or default to empty values.
- Mismatch between the columns returned in SQL select queries and the property mapping logic in Model Factories/Constructors.

## Anti-Pattern Code Blocks
```javascript
// 1. Database table/query returns a new column
const row = await db.query("SELECT id, name, status, sequence_no FROM items WHERE id = $1");

// 2. Model definition doesn't declare or map the new property
class Item {
  constructor({ id, name, status }) {
    this.id = id;
    this.name = name;
    this.status = status;
  }
}

// 3. ModelFactory ignores the new database column
class ModelFactory {
  createItem(row) {
    return new Item({
      id: row.id,
      name: row.name,
      status: row.status
    });
  }
}
```

## Remediation Code Blocks
```javascript
// 1. Model class accepts and maps the new property
class Item {
  constructor({ id, name, status, sequenceNo }) {
    this.id = id;
    this.name = name;
    this.status = status;
    this.sequenceNo = sequenceNo ?? null;
  }
}

// 2. ModelFactory maps database snake_case column to model camelCase property
class ModelFactory {
  createItem(row) {
    return new Item({
      id: row.id,
      name: row.name,
      status: row.status,
      sequenceNo: row.sequence_no
    });
  }
}
```

## Tags
`database`, `architecture`, `clean-code`, `refactoring`
