# ISSUE-031: Hardcoded UI Display Values and Parameter Drift

## Description
Hardcoding values (such as cycle indices, ID numbers, environment flags, or labels) directly in user interface templates/markup while the underlying query, API request, or calculation uses a dynamic configuration variable or state. This leads to visual-to-state drift, where the user is shown one value (e.g. a static text label) but the system actually executes operations using a different parameter.

## Symptoms
- The UI displays a hardcoded identifier, filter boundary, or state variable that does not update when query/fetch parameters change.
- A user makes selections in configuration popups/cards, but the display panel shows outdated or mismatching fixed labels.
- Inconsistent behavior when switching modes or environments, where the visual indicator remains stuck on a default hardcoded value.

## Anti-Pattern Code Blocks
```html
<script setup>
import { ref } from "vue";
const activeCycle = ref(12);
</script>

<template>
  <div>
    <!-- Anti-pattern: Displaying hardcoded cycle number "10" instead of dynamic activeCycle state -->
    <span>Active Cycle: 10</span>
    <button @click="fetchData(activeCycle)">Fetch Data</button>
  </div>
</template>
```

## Remediation Code Blocks
```html
<script setup>
import { ref } from "vue";
const activeCycle = ref(12);
</script>

<template>
  <div>
    <!-- Remediation: Bind display label dynamically to the exact state used in queries -->
    <span>Active Cycle: {{ activeCycle }}</span>
    <button @click="fetchData(activeCycle)">Fetch Data</button>
  </div>
</template>
```

## Tags
`frontend`, `state-management`, `user-experience`, `clean-code`
