# ISSUE-047: Unchecked Nested Property Access on Optional Relations in UI Event Handlers

## Description
Accessing nested properties of optional or nullable domain relations (such as `item.relation.property`) directly within UI event handlers or template callbacks. If the relation is missing or returns null from the backend API, accessing these nested properties throws a runtime `TypeError` (e.g., "Cannot read properties of null"), crashing the component's render or event handler stack and breaking UI interactivity (like table action buttons).

## Symptoms
- Action buttons or table row components completely failing to respond or rendering blank when clicking.
- Javascript console errors throwing `TypeError: Cannot read properties of null (reading 'name')` or similar on user interaction.

## Anti-Pattern Code Blocks
```javascript
// Assumes student relation is always loaded and present in the checklist item
async function handleConfirmAction(data) {
  const result = await openDialog({
    studentId: data.studentId,
    studentName: data.student.name // Throws TypeError if student is null/undefined
  });
}
```

## Remediation Code Blocks
```javascript
// Guard the nested access with optional chaining and a fallback default value
async function handleConfirmAction(data) {
  const studentName = data.student?.name || "N/A";
  const result = await openDialog({
    studentId: data.studentId,
    studentName
  });
}
```

## Tags
`frontend`, `null-safety`, `typescript`
