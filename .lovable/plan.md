

## Plan: Add "Primary Project" checkbox to resource allocations

### What changes

Add an `is_primary` boolean column to `project_members` and a checkbox in each allocation row. Only one allocation per resource can be primary — selecting one automatically deselects the others.

### Database

**Migration**: Add `is_primary` column to `project_members`:
```sql
ALTER TABLE public.project_members ADD COLUMN is_primary boolean NOT NULL DEFAULT false;
```

No new RLS policies needed — existing policies cover the column.

### Code changes

**File: `src/components/resources/ResourceFormDialog.tsx`**

1. Add `is_primary` to the `Allocation` interface.

2. When loading existing allocations, read `is_primary` from `project_members`.

3. Add a `Checkbox` (with label "Primary") in each allocation row, next to the % input. When checked, set all other allocations' `is_primary` to `false`.

4. Include `is_primary` in insert/update calls to `project_members`.

5. Validation: if multiple allocations exist and none is primary, optionally warn (not block).

### UI

Each allocation row will look like:
```text
[Project dropdown] [100] % [✓ Primary] [🗑]
Start: ___  End: ___
```

Clicking "Primary" on one row unchecks all others automatically.

