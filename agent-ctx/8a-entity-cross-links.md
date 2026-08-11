# Task 8a: Entity Cross-Links

## Summary
Added clickable entity ID cross-links in both the DetailDialog and DataTable components, enabling navigation between related entity pages.

## Files Changed
- `src/components/admin/shared/entity-cross-links.ts` (NEW)
- `src/stores/admin.ts`
- `src/components/admin/shared/detail-dialog.tsx`
- `src/components/admin/shared/data-table.tsx`

## Key Details
- Shared `ENTITY_ID_FIELD_MAP` maps field names to AdminPage values
- Store now has `selectedEntityId` + `setSelectedEntityId` (persisted)
- DetailDialog: ghost button with ArrowRight icon navigates to entity + closes dialog
- DataTable: monospace clickable IDs in table cells, card view, and expandable rows
- IDs truncated with title tooltip, primary color, underline on hover
