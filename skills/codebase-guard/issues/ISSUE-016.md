# ISSUE-016: UI Container Layout Overflow from Hardcoded CSS Viewport Calculations

## Description
Using hardcoded CSS calculations (such as `calc(100vh - K)`) to size scrolling elements assumes a static viewport layout. When dynamic layout modifications (such as nesting additional controls, introducing responsive wrapping, or expanding headers) increase the height of the sibling elements, the hardcoded offset `K` is no longer sufficient. This forces the container height to exceed the remaining viewport space, pushing footer elements, paginators, or action buttons off-screen and inducing unwanted scrollbars on the main document body.

## Symptoms
- Table pagination, scrollbars, or footers get pushed off the bottom of the screen.
- Double scrollbars appear on the page (one on the table container and another on the browser window).
- Sibling layout shifts (e.g. toggling responsive filters) break height constraints.

## Anti-Pattern Code Blocks
```html
<!-- Hardcoded offset is fragile when sibling elements grow in height -->
<div class="header-container">
  <h1>Item List</h1>
  <!-- A new filter row is added here, increasing the header height -->
  <div class="filter-row flex-wrap">...</div>
</div>

<DataTable scrollHeight="calc(100vh - 200px)" scrollable>...</DataTable>
```

## Remediation Code Blocks
```html
<!-- 1. Adjust the hardcoded offset to compensate for the expanded height -->
<DataTable scrollHeight="calc(100vh - 240px)" scrollable>...</DataTable>

<!-- 2. Prefer CSS Flexbox to dynamically resolve the remaining height of the container -->
<div class="flex flex-col h-screen">
  <div class="flex-none">
    <h1>Item List</h1>
    <div class="filter-row flex-wrap">...</div>
  </div>
  <!-- flex-1 min-h-0 allows the container to occupy exactly the remaining viewport space -->
  <div class="flex-1 min-h-0 overflow-y-auto">
    <DataTable scrollable class="h-full">...</DataTable>
  </div>
</div>
```

## Tags
`css`, `layout`, `frontend`, `responsive`, `flexbox`
