# NMRHI D1/D2/D3 – Edge Cases & Future Considerations

## Implemented Safeguards

1. **Input validation** – `getActiveGrpIdForDay` and `getLastDayOfMonth` clamp inputs to valid ranges.
2. **Empty state** – Non-current period shows “Add entries during Days X–Y” instead of “Start by adding today’s row”.
3. **API goal type** – Handles both string and number `goal` from API when mapping entries to progress keys.
4. **Draft submit** – Submit disabled when `canAddEntry` is false (e.g. period changed before submit).

## Potential Future Issues

### 1. **Timezone**
- **Current**: Uses `new Date().getDate()` (browser local time).
- **Risk**: If backend uses UTC or another timezone, “current D” may differ from server.
- **Mitigation**: If needed, add a configurable reference date or use server time for “current D”.

### 2. **Filter month vs current day**
- **Current**: “Current D” is based on today’s date, even when viewing a different month.
- **Example**: Today is March 15 (D2); user filters February. D2 “Add Entry” is still enabled; new entry date defaults to today (March 15).
- **Impact**: No backdated entries for past months via the default flow.
- **Mitigation**: Add optional date picker when creating entries for backdating.

### 3. **Draft at period boundary**
- **Scenario**: User adds draft on day 10 (D1), period changes to day 11 (D2) before submit.
- **Current**: Submit is disabled; user must delete draft or wait for next D1 period.
- **Mitigation**: Optional validation that draft date falls in the card’s period before submit.

### 4. **Static data vs API**
- **Current**: `goalIdToKey` is built from static `STRATEGY_CATEGORIES`. New goals from API are ignored.
- **Risk**: Backend adds new actionable goals; they won’t appear until constants are updated.
- **Mitigation**: Consider fetching goals from API or merging API goals with static data.

### 5. **Duplicate entry IDs**
- **Current**: `logs.some((l) => l.id === log.id)` prevents duplicate logs.
- **Risk**: If API returns duplicate entries for the same goal/date, only the first is shown.
- **Mitigation**: Use a composite key (e.g. goal + date + id) if duplicates are valid.

### 6. **Leap year**
- **Current**: `getLastDayOfMonth(2, year)` uses `year` for February.
- **Note**: When `filterMonth` is used without year, current year is used. For historical Feb data in a leap year, this may be incorrect.
- **Mitigation**: Add optional `filterYear` when viewing past years.

### 7. **MD view with filter**
- **Current**: MD sees read-only view; no Add Entry.
- **Note**: Filter by employee/month works; entries load correctly.

### 8. **Concurrent edits**
- **Current**: No optimistic locking; last write wins.
- **Risk**: Two tabs editing the same entry can overwrite each other.
- **Mitigation**: Add version/ETag if backend supports it.
