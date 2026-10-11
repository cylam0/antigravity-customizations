# ISSUE-014: Viewport Scroll Trapping and Percentage Height Resolution Failure in Flexbox Layouts

## Description
Configuring viewport container height using fixed layout constraints with internal scrollbars (like viewport height bounds paired with auto-scrolling) traps document scrolling. This blocks mobile browser user-agent controls (e.g., address/navigation bar collapsing). Furthermore, nesting percentage-based height elements within multi-line flex containers (`flex-wrap`) or containers lacking explicit heights prevents browsers from resolving item heights correctly, causing layout collapse on specific engines (like Safari WebKit).

## Symptoms
- Trapping viewport scrolling inside a nested container with a fixed height viewport unit (e.g., `h-[100vh]`/`h-[100lvh]` combined with `overflow-y-auto`) which blocks native mobile address bar/navigation bar collapsing during scrolling.
- Using percentage heights (e.g., `h-full`, `min-h-full`) on flex items where the parent flex container does not define a clear height/min-height or has `flex-wrap` enabled.
- Incorrect rendering, height collapse, or layout misalignment in Safari or other WebKit-based browsers when evaluating percentage heights within flex-wrapped containers.

## Anti-Pattern Code Blocks
```html
<!-- 1. Scroll trapping on main wrapper prevents mobile address bar collapsing -->
<div class="flex h-[100lvh] flex-col overflow-y-auto">
  <main class="flex-1">...</main>
</div>

<!-- 2. Flex-wrap and lack of parent height breaks child min-h-full resolution -->
<div class="flex flex-1 flex-wrap">
  <div class="w-1/2 min-h-full">...</div>
  <div class="w-1/2 min-h-full">...</div>
</div>
```

## Remediation Code Blocks
```html
<!-- 1. Use min-height and let window handle page scroll -->
<div class="flex min-h-[100lvh] flex-col">
  <main class="flex-1">...</main>
</div>

<!-- 2. Remove flex-wrap and set min-h-full/h-full on parent flex container -->
<div class="flex flex-1 min-h-full">
  <div class="w-1/2 min-h-full">...</div>
  <div class="w-1/2 min-h-full">...</div>
</div>
```

## Tags
`css`, `layout`, `frontend`, `responsive`, `mobile`, `safari`, `flexbox`
