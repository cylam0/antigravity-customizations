# ISSUE-030: Open-Ended Omit Typing for Mutation Payloads

## Description
Using open-ended `Omit` or `Pick` TypeScript helpers directly on a main domain model/interface to derive mutation/update parameter signatures. When the main model is extended with read-only or derived fields, the update helper's parameter type implicitly expands, exposing those read-only fields to mutation updates and causing potential runtime errors, type leaks, or silent failures.

## Symptoms
- Read-only, derived, or UI-only properties (such as calculated status flags or computed booleans) are accepted by toggle or save functions.
- Adding a new field to a UI model interface silently alters the parameter types of distant data mutation utility functions.
- Difficulty in tracking which fields in a data structure are actually editable vs. read-only.

## Anti-Pattern Code Blocks
```typescript
interface StudentItem {
  id: string;
  name: string;
  grade: number;
  isPassing: boolean; // Derived/read-only computed property
}

// Anti-pattern: Omit from domain model automatically allows 'isPassing' when added to StudentItem
function updateStudentField(
  student: StudentItem,
  field: keyof Omit<StudentItem, "id" | "name">
) {
  const nextValue = !student[field];
  // sends request to update student field...
}
```

## Remediation Code Blocks
```typescript
interface StudentItem {
  id: string;
  name: string;
  grade: number;
  isPassing: boolean; // Derived/read-only computed property
}

// Remediation: Define an explicit union or dedicated type for editable fields
type EditableStudentField = "grade";

function updateStudentField(
  student: StudentItem,
  field: EditableStudentField
) {
  const nextValue = typeof student[field] === "boolean" ? !student[field] : student[field];
  // sends request to update student field...
}
```

## Tags
`typescript`, `types`, `refactoring`, `clean-code`
