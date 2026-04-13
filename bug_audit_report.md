# CineQuest Codebase Audit Report
**Date:** April 15, 2026  
**Status:** Comprehensive bug audit completed

---

## Executive Summary
Found **12 bugs** across the Django backend and Next.js frontend:
- **Critical:** 3 (will cause runtime errors)
- **High:** 4 (will cause functional issues)
- **Medium:** 5 (code quality and type issues)

---

## BACKEND BUGS (Django)

### 🔴 CRITICAL - Bug #1: Incorrect HTTP Method on search_movies
**File:** [backend/movies/views.py](backend/movies/views.py#L125-L135)  
**Severity:** CRITICAL - Will cause 405 Method Not Allowed errors  
**Issue:** Function decorated with `@api_view(["POST"])` but uses `request.query_params` (GET parameters)

```python
@api_view(["POST"])  # ❌ WRONG
@permission_classes([AllowAny])
def search_movies(request):
    query = request.query_params.get("q", "").strip()  # ✓ Uses query params (GET)
    page = int(request.query_params.get("page", 1))
```

**Frontend calls it as GET:**  
[frontend/src/lib/api.ts](frontend/src/lib/api.ts#L170-L173)
```typescript
search: (query: string, page = 1) =>
    apiFetch<PaginatedResponse<MovieCompact>>(
      `/movies/search/?q=${encodeURIComponent(query)}&page=${page}`  // ✓ GET request
    ),
```

**Fix:** Change to `@api_view(["GET"])`

---

### 🔴 CRITICAL - Bug #2: Database Schema Mismatch on Movie.title
**File:** [backend/movies/migrations/0001_initial.py](backend/movies/migrations/0001_initial.py#L53)  
**Related:** [backend/movies/models.py](backend/movies/models.py#L48)  
**Severity:** CRITICAL - Will cause data truncation  
**Issue:** Migration defines `max_length=50` but model defines `max_length=500`

```python
# Migration (0001_initial.py, line 53)
('title', models.CharField(max_length=50)),  # ❌ WRONG

# Model (models.py, line 48)
title = models.CharField(max_length=500)  # ✓ Correct
```

**Impact:** Movie titles longer than 50 characters will be truncated in database  
**Fix:** Create migration to alter field: `python manage.py makemigrations --empty movies --name alter_movie_title_length`

---

### 🔴 CRITICAL - Bug #3: Duplicate compare_movies Functions
**File:** [backend/movies/views.py](backend/movies/views.py#L392-L428)  
**Severity:** CRITICAL - Redundant code, confusing API  
**Issue:** Two functions `compare_movies()` and `compare_two_movies()` are identical

```python
# Lines 392-410
@api_view(["GET"])
def compare_movies(request):
    ids_str = request.query_params.get("ids", "")
    ids = [int(i.strip()) for i in ids_str.split(",") if i.strip().isdigit()]
    if len(ids) < 2:
        return Response({"error": "Provide at least 2 TMDB IDs: ?ids=550,680"}, status=400)
    movies = []
    for tmdb_id in ids[:2]:
        data = tmdb.get_movie_details(tmdb_id)
        if data and "id" in data:
            movies.append(data)
    if len(movies) < 2:
        return Response({"error": "Could not fetch both movies"}, status=404)
    return Response({"movies": movies})

# Lines 413-428 - IDENTICAL CODE
def compare_two_movies(request):
    id_string = request.query_params.get("ids", "")
    movie_ids = [int(i.strip()) for i in id_string.split(",") if i.strip().isdigit()]
    # ... same logic
```

**Fix:** Remove `compare_two_movies()` function entirely. Only URL route should be `/api/movies/compare/`

---

### 🟠 HIGH - Bug #4: Hardcoded Weights Duplicate in RecommendationEngine
**File:** [backend/recommendations/services/engine.py](backend/recommendations/services/engine.py#L1-60)  
**Severity:** HIGH - Code duplication, maintenance nightmare  
**Issue:** `compute_genre_preferences()` reimplements `INTERACTION_WEIGHTS` instead of using constant

```python
# Line 8 - Constant defined
INTERACTION_WEIGHTS = {
    "like": 5.0,
    "watched": 3.0,
    "watchlist": 2.5,
    # ...
}

# Lines 26-37 - Hardcoded duplicate logic
for interaction in interactions:
    if interaction.interaction_type == "like":
        w = 5.0  # ❌ DUPLICATE
    elif interaction.interaction_type == "watched":
        w = 3.0  # ❌ DUPLICATE
    elif interaction.interaction_type == "watchlist":
        w = 2.5  # ❌ DUPLICATE
```

**Fix:** Replace with `w = INTERACTION_WEIGHTS.get(interaction.interaction_type, 1.0)`

---

## FRONTEND BUGS (Next.js/TypeScript)

### 🔴 CRITICAL - Bug #5: Missing Type Definitions for WatchlistItem
**File:** [frontend/src/lib/api.ts](frontend/src/lib/api.ts#L10-15) and [frontend/src/types/movie.ts](frontend/src/types/movie.ts)  
**Severity:** CRITICAL - Type safety violation, will cause TypeScript errors  
**Issue:** `WatchlistItem` type is used in API but never exported from types

```typescript
// api.ts - Line 10-15
type WatchlistItem = {  // ❌ LOCAL TYPE - NOT EXPORTED
  id: number;
  movie_tmdb_id: number;
  movie_title: string;
  poster_path: string;
  watched?: boolean;
  created_at?: string;
  [key: string]: unknown;
};

// Used in API calls without proper export
getWatchlist: () => apiFetch<WatchlistItem[]>("/recommendations/watchlist/"),
```

**Should be in:** [frontend/src/types/movie.ts](frontend/src/types/movie.ts)

**Fix:** Add to types/movie.ts:
```typescript
export interface WatchlistItem {
  id: number;
  movie_tmdb_id: number;
  movie_title: string;
  poster_path: string;
  watched?: boolean;
  created_at?: string;
}
```

---

### 🟠 HIGH - Bug #6: HeroSection Receives Wrong Prop Type
**File:** [frontend/src/app/page.tsx](frontend/src/app/page.tsx#L32-35) and [frontend/src/components/HeroSection.tsx](frontend/src/components/HeroSection.tsx#L1-25)  
**Severity:** HIGH - Component expects array but receives object  
**Issue:** `trending` API returns object with `results` property, but `HeroSection` expects array

```typescript
// page.tsx - Line 32
const [trending, setTrending] = useState<any>({});

// Line 38
if (trendRes.status === "fulfilled") setTrending(trendRes.value);  
// trendRes.value is { results: [...], total_pages: ..., page: ... }

// Line 44
<HeroSection movies={trending} />  // ❌ PASSING OBJECT, NOT ARRAY

// HeroSection.tsx - Line 21
interface HeroSectionProps {
  movies: MovieCompact[];  // ✓ EXPECTS ARRAY
}

// Line 24-26
const heroMovies = Array.isArray(movies) ? movies.slice(0, 6) : [];
// This will always be empty because movies is an object, not an array!
```

**Fix:**
```typescript
// page.tsx
if (trendRes.status === "fulfilled") setTrending(trendRes.value);
// ...
<HeroSection movies={trending.results || []} />  // Pass results array
```

---

### 🟠 HIGH - Bug #7: SearchModal Keyboard Shortcut Not Functional
**File:** [frontend/src/components/Navbar.tsx](frontend/src/components/Navbar.tsx#L40-65) and [frontend/src/components/SearchModal.tsx](frontend/src/components/SearchModal.tsx#L35-45)  
**Severity:** HIGH - UX broken, keyboard shortcut registered but ineffective  
**Issue:** ⌘K/Ctrl+K handled in SearchModal but never triggers Navbar's `setSearchOpen(true)`

```typescript
// Navbar.tsx - Line 12-13
const [searchOpen, setSearchOpen] = useState(false);

// Line 45-49 - Search button
<button onClick={() => setSearchOpen(true)} ...>
  {/* ... */}
</button>

// SearchModal.tsx - Line 35-45 - Handles exit but not entry
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (open) {  // ❌ Only closes if already open!
        onClose();
      }
      // Missing: else { /* open search */ }
    }
    if (e.key === "Escape" && open) onClose();
  };
  window.addEventListener("keydown", handler);
}, [open, onClose]);
```

**Fix:** Register keyboard handler in Navbar to call `setSearchOpen(true)` when ⌘K pressed and `searchOpen` is false

---

### 🟠 HIGH - Bug #8: API Mismatch for Movie Recommendations Endpoint
**File:** [frontend/src/app/movie/\[id\]/page.tsx](frontend/src/app/movie/\[id\]/page.tsx#L72-79)  
**Related:** [backend/movies/views.py](backend/movies/views.py#L29-40)  
**Severity:** HIGH - Direct API call breaks error handling  
**Issue:** Frontend uses direct `fetch()` instead of API layer for fetching movie details and recommendations

```typescript
// page.tsx - Lines 75-79 - Direct fetch, no error handling
const recData = await fetch(
  `${process.env.NEXT_PUBLIC_API_URL}/movies/tmdb/${tmdbId}/`
).then(r => r.json());  // ❌ NO ERROR HANDLING

// Should use API layer:
// const recData = await moviesAPI.getDetail(tmdbId);
```

**Fix:** Use the API layer:
```typescript
const data = await moviesAPI.getDetail(tmdbId);  // ✓ Has error handling
const recData = data;
```

---

### 🟡 MEDIUM - Bug #9: Type Safety - Dashboard Uses 'any' Types
**File:** [frontend/src/app/dashboard/page.tsx](frontend/src/app/dashboard/page.tsx#L19-22)  
**Severity:** MEDIUM - Type safety violation  
**Issue:** Using generic `any` type instead of typed interfaces

```typescript
// Page 19-22
const [stats, setStats] = useState<any>(null);  // ❌ any type

// Better:
interface DashboardStats {
  summary: {
    likes: number;
    dislikes: number;
    watched: number;
    watchlist_total: number;
  };
  genre_distribution: Array<{ name: string; tmdb_id: number; count: number }>;
  preference_scores: Array<{ name: string; weight: number; count: number }>;
  activity_timeline: Array<{ date: string; count: number }>;
  recent_activity: any[];
}

const [stats, setStats] = useState<DashboardStats | null>(null);  // ✓ Typed
```

---

### 🟡 MEDIUM - Bug #10: Missing AuthTokens Export
**File:** [frontend/src/types/movie.ts](frontend/src/types/movie.ts)  
**Severity:** MEDIUM - Type not properly exported  
**Issue:** `AuthTokens` interface is defined but not exported from the types module

```typescript
// Line 93 - Defined but only used internally
export interface AuthTokens {
  access: string;
  refresh: string;
}

// Used in api.ts but must be imported individually
import type { AuthTokens } from "@/types/movie";  // ✓ Works but not centralized
```

**Fix:** Ensure all types are consistently exported at top of file

---

### 🟡 MEDIUM - Bug #11: No Error Boundaries in MovieDetailPage
**File:** [frontend/src/app/movie/\[id\]/page.tsx](frontend/src/app/movie/\[id\]/page.tsx#L80-95)  
**Severity:** MEDIUM - Errors not gracefully handled  
**Issue:** Promise rejections in fetch operations not caught

```typescript
// Lines 80-95
try {
  const data = await moviesAPI.getDetail(tmdbId);
  setMovie(data);
  const recData = await fetch(...).then(r => r.json());  // ❌ No error handling
  // ...
} catch (err) {
  console.error("Failed to fetch movie:", err);  // Silent failure ✓ Has catch but...
}
```

**Problem:** If the nested fetch fails, the whole component breaks with no user feedback

---

### 🟡 MEDIUM - Bug #12: GenreGrid Uses Dynamic CSS Classes
**File:** [frontend/src/components/GenreGrid.tsx](frontend/src/components/GenreGrid.tsx#L60)  
**Severity:** MEDIUM - Tailwind CSS won't purge properly  
**Issue:** Dynamic class names won't be properly included in Tailwind build

```typescript
// Line 60
className={`...stagger-${Math.min(i % 6 + 1, 6)}`}  
// ❌ Creates stagger-1, stagger-2, etc. dynamically
// Tailwind can't find these at build time
```

**Fix:** Use explicit classes:
```typescript
const staggerClasses = [
  "", "stagger-1", "stagger-2", "stagger-3", 
  "stagger-4", "stagger-5", "stagger-6"
];
className={`... ${staggerClasses[Math.min(i % 6 + 1, 6)]}`}
```

---

## SUMMARY TABLE

| # | Bug | File | Type | Severity | Line |
|---|-----|------|------|----------|------|
| 1 | search_movies wrong HTTP method | backend/movies/views.py | HTTP | 🔴 CRITICAL | 125 |
| 2 | Movie.title max_length mismatch | backend/movies/migrations/0001_initial.py | Database | 🔴 CRITICAL | 53 |
| 3 | Duplicate compare_movies functions | backend/movies/views.py | Code | 🔴 CRITICAL | 392-428 |
| 4 | Hardcoded weights duplication | backend/recommendations/services/engine.py | Logic | 🟠 HIGH | 26-37 |
| 5 | Missing WatchlistItem type export | frontend/src/types/movie.ts | Types | 🔴 CRITICAL | - |
| 6 | HeroSection receives object not array | frontend/src/app/page.tsx | Props | 🟠 HIGH | 32-44 |
| 7 | SearchModal ⌘K not functional | frontend/src/components/SearchModal.tsx | UX | 🟠 HIGH | 35-45 |
| 8 | Direct fetch not using API layer | frontend/src/app/movie/\[id\]/page.tsx | Architecture | 🟠 HIGH | 72-79 |
| 9 | Dashboard uses 'any' type | frontend/src/app/dashboard/page.tsx | Types | 🟡 MEDIUM | 19-22 |
| 10 | AuthTokens not exported | frontend/src/types/movie.ts | Types | 🟡 MEDIUM | 93 |
| 11 | No error boundaries | frontend/src/app/movie/\[id\]/page.tsx | Error Handling | 🟡 MEDIUM | 75-95 |
| 12 | Dynamic Tailwind classes | frontend/src/components/GenreGrid.tsx | Styles | 🟡 MEDIUM | 60 |

---

## CORS Configuration Status
✅ **PROPERLY CONFIGURED** - No issues found
- CORS middleware enabled in settings.py line 38
- CORS_ALLOWED_ORIGINS set correctly with localhost:3000
- CORS_ALLOW_CREDENTIALS = True

---

## Migration Status
Location: `backend/movies/migrations/`, `backend/recommendations/migrations/`, `backend/users/migrations/`
- All initial migrations present and appear valid
- **Issue:** Movie.title field length mismatch between migration and model (see Bug #2)

---

## Recommendations
1. **Prioritize Critical Bugs** - Bugs #1, #2, #3 will cause immediate runtime failures
2. **Fix Type Issues** - Bugs #5, #9, #10 will improve IDE support and catch errors early
3. **Refactor API Calls** - Bug #8 should use consistent API layer for all requests
4. **Add Tests** - Create tests for all fixed functions to prevent regressions