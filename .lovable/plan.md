

## Plan: Add "Delete All Selected" to Timesheets Bulk Actions

### What changes

Add a "Delete Selected" button next to the existing "Approve Selected" button in the bulk actions bar. It will soft-delete all selected time entries after a confirmation dialog.

### Implementation

**File: `src/pages/Timesheets.tsx`**

1. **Add a bulk delete mutation** — similar to `bulkApproveMutation`, but sets `deleted_at` on all selected IDs using `.in("id", ids)`.

2. **Add state for bulk delete confirmation** — `showBulkDelete` boolean to control a `DeleteConfirmDialog`.

3. **Add "Delete Selected" button** in the bulk actions bar (line ~331-339), styled as destructive variant, next to "Approve Selected".

4. **Add `DeleteConfirmDialog`** for bulk delete — shows count of entries to be deleted, calls the bulk delete mutation on confirm, clears selection on success.

5. **Import `Trash2`** icon (already imported).

### UI

The bulk actions bar will show:
```text
[12 selected] [✓ Approve Selected] [🗑 Delete Selected] [Deselect All]
```

Clicking "Delete Selected" opens a confirmation dialog before executing.

