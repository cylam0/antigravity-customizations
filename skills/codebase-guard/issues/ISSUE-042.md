# ISSUE-042: Interleaved Import Declarations in Vue Component Script setup

## Description
Interleaving `import` statements with runtime code (such as variable assignments, reactive ref definitions, or hook declarations) within script files (e.g. `<script setup>` block in Vue 3). This violates lint rules (like `import/first` / `import-order`), increases visual noise, and makes it harder to scan dependencies. All imports must be consolidated at the top of the script block.

## Symptoms
- An `import` statement occurring after runtime declarations (e.g. `const state = ref(false)`).

## Anti-Pattern Code Blocks
```html
<script setup>
import { ref } from "vue";
const state = ref(false);

import { useToast } from "primevue/usetoast"; // Anti-pattern: interleaved import
</script>
```

## Remediation Code Blocks
```html
<script setup>
import { ref } from "vue";
import { useToast } from "primevue/usetoast"; // Remediation: consolidated at top

const state = ref(false);
</script>
```

## Tags
`clean-code`, `refactoring`
