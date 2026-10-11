# ISSUE-045: Component Unmounting Race Condition on Dialog v-model Closures

## Description
Binding a dynamic component's visibility using two-way `v-model:visible` when it is mounted inside a dynamic parent wrapper that listens to computed visibility changes. Because the unmounting happens synchronously within the computed setter or store action in the same execution stack as the child's visibility change, the child component is torn down and destroyed before its own cleanup, `@hide` event, or standard `@close` result emission can execute, leading to lost payload parameters.

## Symptoms
- Dialog promise resolving to `undefined` instead of the expected return payload (e.g. `hasChanges` or confirmation result).
- Dynamic wrappers intercepting `update:visible` to destroy/unmount child modals immediately.
- `@hide` event listeners on inner dialogs not triggering because the component is unmounted prematurely.

## Anti-Pattern Code Blocks
```vue
<!-- GlobalDialog.vue (Parent Wrapper) -->
<component :is="activeDialog.component" v-model:visible="visible" @close="store.close" />

<!-- InnerDialog.vue (Child Component) -->
<template>
  <PrimeDialog v-model:visible="visible" @hide="emit('close', payload)">
    <!-- Content -->
  </PrimeDialog>
</template>
```

## Remediation Code Blocks
```vue
<!-- InnerDialog.vue (Child Component) -->
<script setup>
const visible = defineModel('visible');
const emit = defineEmits(['close']);

function handleUpdateVisible(val) {
  if (!val) {
    // Emit close payload first before updating visible or parent unmounting
    emit('close', payload.value);
  }
}
</script>

<template>
  <PrimeDialog :visible="visible" @update:visible="handleUpdateVisible">
    <!-- Content -->
  </PrimeDialog>
</template>
```

## Tags
`frontend`, `vue`, `lifecycle`, `race-condition`
