# Client List Sorting, Search, and Pagination - Implementation Summary

## Changes Implemented

### 1. Multi-Field Search
**Before:** Search only by client name
**After:** Search across name, phone, and tax ID

- **Fields searched:** name, main_phone, tax_id (OR logic)
- **Query parameter:** `q` (unchanged, behavior enhanced)
- **Case-insensitive:** Using ILIKE for PostgreSQL
- **Example:** Search "050-123" finds clients by phone number

### 2. Column Sorting
**Before:** No sorting (database order)
**After:** Sortable columns with visual indicators

- **Sortable fields:** name, main_phone, tax_id
- **Default sort:** name ASC
- **Query parameters:**
  - `sort` (name|main_phone|tax_id, default: name)
  - `order` (asc|desc, default: asc)
- **Whitelist enforcement:** Only allowed fields can be sorted
- **UI:** TableSortLabel components show active column and direction

### 3. Pagination Enhancements
**Before:** Basic pagination (page + page_size)
**After:** Full pagination with controls

- **Default page_size:** Changed from 25 to 20
- **New field:** `total_pages` in response
- **UI controls:**
  - MUI Pagination component with first/last buttons
  - Page indicator: "עמוד X מתוך Y" (Hebrew: "Page X of Y")
  - Prev/Next buttons
- **State reset:** Page resets to 1 on search/sort/filter change

### 4. URL State Sync
**Before:** State only in component memory
**After:** Full URL query parameter sync

- **URL parameters synced:**
  - `q` - search query
  - `sort` - sort field
  - `order` - sort order
  - `page` - current page
  - `include_inactive` - show inactive filter (as "1")
- **Benefits:**
  - Shareable URLs
  - Browser back/forward navigation
  - Page refresh preserves state
- **Default handling:** Omits default values from URL (name, asc, page 1)

## Files Modified

### Backend

**`backend/app/schemas/clients.py`**
- Added `total_pages: int` to `ClientListResponse`

```python
class ClientListResponse(BaseModel):
    """Paginated list of clients."""
    items: List[ClientResponse]
    total: int
    page: int
    page_size: int
    total_pages: int  # ADDED
```

**`backend/app/api/clients.py`**
- Added `sort` and `order` query parameters
- Changed `page_size` default from 25 to 20
- Enhanced `q` parameter description
- Implemented multi-field search with OR logic
- Added sort field whitelist with column mapping
- Implemented sorting (ASC/DESC)
- Added total_pages calculation
- Updated docstring with search and sorting documentation

```python
@router.get("", response_model=ClientListResponse)
async def list_clients(
    q: Optional[str] = Query(None, description="Search by name, phone, or tax ID"),
    include_inactive: bool = Query(False, description="Include inactive clients"),
    sort: Optional[str] = Query("name", description="Sort field: name, main_phone, tax_id"),
    order: Optional[str] = Query("asc", description="Sort order: asc, desc"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    current_user: CurrentUser = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    # ... RBAC and active/inactive filters

    # Multi-field search
    if q:
        search_term = f"%{q}%"
        query = query.filter(
            (Client.name.ilike(search_term)) |
            (Client.main_phone.ilike(search_term)) |
            (Client.tax_id.ilike(search_term))
        )

    # Sorting with whitelist
    sort_whitelist = {"name": Client.name, "main_phone": Client.main_phone, "tax_id": Client.tax_id}
    if sort not in sort_whitelist:
        sort = "name"

    sort_column = sort_whitelist[sort]
    if order == "desc":
        query = query.order_by(sort_column.desc())
    else:
        query = query.order_by(sort_column.asc())

    # ... count and pagination

    # Calculate total pages
    total_pages = (total + page_size - 1) // page_size if total > 0 else 1

    return ClientListResponse(
        items=clients,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )
```

### Frontend

**`frontend/src/types/index.ts`**
- Added `total_pages: number` to `ClientListResponse`

```typescript
export interface ClientListResponse {
  items: Client[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;  // ADDED
}
```

**`frontend/src/api/clients.ts`**
- Added `sort?: string` parameter
- Added `order?: string` parameter

```typescript
listClients: async (params?: {
  q?: string;
  include_inactive?: boolean;
  sort?: string;      // ADDED
  order?: string;     // ADDED
  page?: number;
  page_size?: number;
}): Promise<ClientListResponse>
```

**`frontend/src/components/Clients/ClientsList.tsx`**

Major changes:

1. **Added imports:**
   - `useState, useEffect` from React
   - `TableSortLabel, Pagination` from MUI
   - `useSearchParams` from react-router-dom

2. **State management:**
   - Added `searchParams` and `setSearchParams` hooks
   - Added `sort` state (default: 'name')
   - Added `order` state (default: 'asc')
   - Initialize all state from URL parameters

3. **URL sync effect:**
   - `useEffect` syncs state to URL query parameters
   - Omits default values to keep URLs clean

4. **Query updates:**
   - Changed `page_size` from 25 to 20
   - Added `sort` and `order` to queryKey
   - Added `sort` and `order` to API call

5. **Sort handler:**
   - `handleSort(field)` toggles order if same field
   - Resets to ASC if switching fields
   - Resets page to 1 on sort change

6. **Table headers:**
   - Wrapped Name, Tax ID, Phone columns in `<TableSortLabel>`
   - Shows active state and direction indicators
   - Clicking headers calls `handleSort`

7. **Pagination UI:**
   - Added Hebrew page indicator
   - Added `<Pagination>` component with first/last buttons
   - Positioned in flex layout at bottom

```typescript
export const ClientsList: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Initialize state from URL
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [showInactive, setShowInactive] = useState(searchParams.get('include_inactive') === '1');
  const [sort, setSort] = useState(searchParams.get('sort') || 'name');
  const [order, setOrder] = useState<'asc' | 'desc'>((searchParams.get('order') as 'asc' | 'desc') || 'asc');
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10));
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Sync state to URL
  useEffect(() => {
    const params: Record<string, string> = {};
    if (searchQuery) params.q = searchQuery;
    if (showInactive) params.include_inactive = '1';
    if (sort !== 'name') params.sort = sort;
    if (order !== 'asc') params.order = order;
    if (page !== 1) params.page = page.toString();
    setSearchParams(params);
  }, [searchQuery, showInactive, sort, order, page, setSearchParams]);

  // Query with all parameters
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['clients', searchQuery, showInactive, sort, order, page],
    queryFn: () => clientsApi.listClients({
      q: searchQuery,
      include_inactive: showInactive,
      sort,
      order,
      page,
      page_size: 20
    }),
  });

  // Sort handler
  const handleSort = (field: string) => {
    if (sort === field) {
      setOrder(order === 'asc' ? 'desc' : 'asc');
    } else {
      setSort(field);
      setOrder('asc');
    }
    setPage(1);
  };

  // Table with sortable headers
  <TableSortLabel
    active={sort === 'name'}
    direction={sort === 'name' ? order : 'asc'}
    onClick={() => handleSort('name')}
  >
    {t('clients.name')}
  </TableSortLabel>

  // Pagination UI
  <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <Typography variant="body2" color="text.secondary">
      {t('app.loading')}: {data.items.length} / {data.total}
    </Typography>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <Typography variant="body2" color="text.secondary">
        עמוד {data.page} מתוך {data.total_pages}
      </Typography>
      <Pagination
        count={data.total_pages}
        page={data.page}
        onChange={(_, value) => setPage(value)}
        color="primary"
        showFirstButton
        showLastButton
      />
    </Box>
  </Box>
```

## Testing

### Backend Test
**File:** `backend/test_client_sort_search.py`

**Tests:**
1. Sort by name ASC (alphabetical order)
2. Sort by name DESC (reverse alphabetical)
3. Multi-field search by name
4. Multi-field search by phone
5. Multi-field search by tax_id
6. Pagination (offset/limit)
7. Total pages calculation

**Results:**
```
[PASS] Name sorting ASC works
[PASS] Name sorting DESC works
[PASS] Search by name works
[PASS] Search by phone works
[PASS] Search by tax_id works
[PASS] Pagination works
[PASS] Total pages calculation works
TEST PASSED: Sorting, search, and pagination work!
```

### Manual Testing Checklist

1. **Default state:**
   - List loads sorted by name ASC
   - URL shows no query params (all defaults)
   - Only active clients shown

2. **Sorting:**
   - Click Name header → toggles ASC/DESC
   - Click Tax ID header → sorts by tax_id ASC, resets page
   - Click Phone header → sorts by phone ASC, resets page
   - Active column shows visual indicator

3. **Search:**
   - Search by client name → finds matches
   - Search by phone number → finds matches
   - Search by tax ID → finds matches
   - Page resets to 1 on search

4. **Pagination:**
   - Navigate pages using pagination controls
   - First/Last buttons work
   - Page indicator shows "עמוד X מתוך Y"
   - URL updates with page number

5. **URL state:**
   - Refresh page → state preserved
   - Browser back/forward → state preserved
   - Share URL → recipient sees same view
   - Bookmark URL → preserves filters/sort/page

6. **Combined:**
   - Search + sort + paginate → all work together
   - Toggle inactive → resets page, preserves sort
   - Change search → resets page, preserves sort

## Technical Notes

### Backend Implementation
- **Multi-field OR search:** Uses SQLAlchemy OR operator with ILIKE
- **Sort whitelist:** Prevents SQL injection via column whitelisting
- **Total pages calculation:** Ceiling division: `(total + page_size - 1) // page_size`
- **Edge case:** Returns `total_pages = 1` when total is 0

### Frontend Implementation
- **URL sync pattern:** useEffect with setSearchParams
- **State initialization:** Parse URL params on mount
- **Default omission:** Cleaner URLs by omitting default values
- **React Query integration:** Sort/order in queryKey for cache separation
- **RTL compatibility:** Pagination component handles RTL automatically

### Performance
- **Server-side operations:** All filtering, sorting, pagination done in DB
- **Query efficiency:** Single query with combined filters
- **Cache invalidation:** Separate cache entries per sort/order/page
- **Network optimization:** Only 20 items per page (reduced from 25)

### Security
- **Sort field whitelist:** Prevents arbitrary column sorting
- **SQL injection prevention:** Parameterized queries via SQLAlchemy
- **Input validation:** Query params validated by FastAPI

## API Changes Summary

### Request Parameters (GET /clients)
```
q              string   optional   Search across name, phone, tax_id
include_inactive bool   optional   Include inactive clients (default: false)
sort           string   optional   Sort field: name|main_phone|tax_id (default: name)
order          string   optional   Sort order: asc|desc (default: asc)
page           integer  optional   Page number (default: 1)
page_size      integer  optional   Items per page (default: 20, max: 100)
```

### Response Format
```json
{
  "items": [...],
  "total": 81,
  "page": 1,
  "page_size": 20,
  "total_pages": 5
}
```

## Migration Notes
- **No database changes:** All existing columns used
- **Backward compatible:** New params optional with sensible defaults
- **Frontend compatible:** total_pages addition doesn't break old clients
- **API versioning:** No version bump needed (additive change)

## Summary of Improvements

✅ **Enhanced search:** Find clients by name, phone, or tax ID
✅ **Sortable columns:** Click headers to sort by name, phone, or tax ID
✅ **Better pagination:** Visual controls with page indicator
✅ **URL state sync:** Shareable, bookmarkable, back-button friendly
✅ **RTL compatible:** Hebrew text, proper alignment
✅ **Performance:** Server-side operations, reduced page size
✅ **Security:** Whitelisted sort fields, parameterized queries
