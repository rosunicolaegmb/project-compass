

## Investigație Admiral Money Grow Team — €114K vs €206,620 așteptat

### Date confirmate din DB (yearly 2026)

| Metric | Valoare |
|---|---|
| Entries billable | 489 |
| Total hours | 3,912 |
| Currency | GBP (uniform) |
| Revenue native | **£179,670** |
| Rate GBP→EUR (Jan-Dec 2026) | 1.15 (uniform) |
| Revenue EUR așteptat | **€206,620** |
| Distribuție | doar Jan/Feb/Mar 2026 (£59,890/lună) |

### Ce NU este cauza

- ❌ Inversare rate (1/1.15 = 0.87 → ar da €156K, nu €114K)
- ❌ Date inconsistente (toate entries sunt GBP, toate rate-urile sunt 1.15)
- ❌ Lipsă rate-uri (toate cele 12 luni au rate setat)
- ❌ Entries lipsă (489 entries × media rate ≈ £179,670 = match)

### Ce nu am putut confirma (am nevoie de input)

Numărul **€114K** nu se obține matematic din nicio combinație normală de rate × £179,670. Înainte să propun un fix, trebuie să știu **exact unde** apare 114K, pentru că Dashboard-ul are mai multe widget-uri care arată sume per proiect:

### Întrebări pentru tine

1. **Unde exact** vezi €114K?
   - (a) **Dashboard → tabelul "Project Financials"**, coloana "Projected Revenue", filtru Yearly 2026
   - (b) **Dashboard → KPI cards** (Total Revenue / Cost / Margin)
   - (c) **Project Detail page** (`/projects/aac5cae4...`)
   - (d) Altundeva (Reports? Forecasting?)

2. Coloana exactă: e **Revenue**, **Cost**, **Profit** sau **Budget**?

3. Poți face un **screenshot** sau citi exact tooltip-ul/numărul afișat? (ex: "€114K" vs "€114,000" vs "€-114K")

### Plan de acțiune după ce confirm

Odată ce știu **widget-ul exact**:
1. Reproduc query-ul + `useMemo`-ul din componenta respectivă cu datele DB
2. Identific dacă e: (a) race condition `loadConversionRates`, (b) filtru ascuns (status, deleted, allocation), (c) bug în `calculateLaborCostAllocation` care contaminează revenue, (d) altceva
3. Propun fix țintit (un singur fișier, fără side-effects pe alte calcule)

**Nu modific nimic până nu confirm cifra exactă și locul.**

