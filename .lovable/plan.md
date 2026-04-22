

## Multi-Resource Selection în Log Month

### Schimbare propusă
În dialogul **Log Full Month** (Timesheets → "Log Month"), câmpul **Resource** devine **multi-select**, permițând pontarea simultană pentru mai multe resurse cu aceleași date (zile, ore/zi, billable, notes).

Pentru fiecare resursă selectată se vor crea time entries identice ca structură, dar cu **rate-uri proprii** (bill_rate / cost_rate / currency luate din profilul fiecărei resurse), păstrând logica de calcul revenue & cost neschimbată.

### UX

```text
Project *        [Select project ▾]
Resources *      [☑ Alice  ☑ Bob  ☐ Carol  ...]   ← multi-select cu checkbox
                 (filtrate după alocările proiectului)
Phase            [Select phase ▾]
Month            [2026-02]
[Calendar - selectare zile]
Hours per day *  [8]
☑ Billable
☑ Skip weekends
☑ Skip days with existing entries
Notes            [...]

Summary:
  Resources selected: 3
  Days selected: 20
  Total entries: 60  (3 × 20)
  Total hours: 480
```

Reporter (rol non-admin) rămâne forțat la propria resursă (single, disabled) — același comportament ca azi.

### Modificări tehnice

**Fișier**: `src/components/timesheets/MonthlyTimeEntryDialog.tsx`

1. **Schema**: înlocuim `resource_id: string` cu `resource_ids: string[].min(1)`. Eliminăm câmpurile globale `bill_rate` / `daily_rate` / `currency` din formular (rate-ul devine per-resursă, nu global).
2. **UI Resources**: înlocuim `<Select>` cu o listă scrollabilă de `<Checkbox>` (sau popover cu search dacă sunt multe resurse), filtrată după `projectMembers` pentru proiectul ales. Buton "Select all / Deselect all" pentru resurse.
3. **Reporter mode**: dacă `reporterResourceId` e setat → lista e disabled, doar resursa proprie bifată.
4. **Mutation** (insert):
   - Pentru fiecare `resource_id` din selecție:
     - Iau `bill_rate` = `resource.default_bill_rate`, `currency` = `resource.currency` (fallback EUR)
     - Aplic skip_existing per (resource, project) — query cu `.in("resource_id", selectedIds)` apoi grupez per resursă
     - Construiesc batch-uri de inserare (`resource_id`, `project_id`, `phase_id`, `entry_date`, `hours`, `is_billable`, `description`, `bill_rate`, `currency`)
   - Insert în batch-uri de 50 (la fel ca acum)
5. **Toast result**: "Created N entries across M resources (K days skipped — already existed)"
6. **Summary card**: afișez `Resources × Days = Total entries` și `Total hours = entries × hours/day`

### Ce NU se schimbă
- Logica de calcul **revenue** (bill_rate × hours) și **cost** (pool overhead + salariu din `labor-cost-allocation.ts`) rămân identice. Bill_rate-ul scris în fiecare time entry este preluat tot din `resource.default_bill_rate`, ca în varianta single-resource actuală.
- Componenta `TimeEntryFormDialog` (single entry) rămâne neatinsă.
- Edge function `allocate-monthly-costs` rămâne neatinsă.
- Pool-ul de overhead (general_expenses ÷ N resurse cu salary>0) rămâne identic.

### Edge cases
- Dacă un proiect nu are membri alocați → afișez toate resursele (comportament actual păstrat).
- Dacă o resursă selectată nu are `default_bill_rate` → bill_rate = `null` (la fel ca azi când lipsește).
- `skip_existing` se aplică independent pentru fiecare resursă (o resursă poate sări 5 zile, alta 0).

