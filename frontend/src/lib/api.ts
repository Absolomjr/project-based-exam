import type {
  MovieCompact,
  MovieDetail,
  Genre,
  Person,
  PaginatedResponse,
  AuthTokens,
  User,
  GenrePreference,
  WatchlistItem,
  JourneyTimelineResponse,
} from "@/types/movie";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
const JOURNEY_ENDPOINT_CACHE_KEY = "cq_journey_endpoint_available";

type DashboardApiResponse = {
  summary: {
    total_interactions: number;
    likes: number;
    dislikes: number;
    watched: number;
    searches: number;
    watchlist_total: number;
  };
  activity_timeline: Array<{ date: string; count: number }>;
  recent_activity: Array<{
    interaction_type: "search" | "view" | "like" | "dislike" | "watchlist" | "watched";
    movie_title: string;
    created_at: string;
    movie_tmdb_id?: number;
  }>;
};

type JourneyEventType = "search" | "view" | "like" | "dislike" | "watchlist" | "watched";

function getJourneyEndpointAvailability(): boolean | null {
  if (typeof window === "undefined") return null;
  const value = sessionStorage.getItem(JOURNEY_ENDPOINT_CACHE_KEY);
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function setJourneyEndpointAvailability(isAvailable: boolean) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(JOURNEY_ENDPOINT_CACHE_KEY, String(isAvailable));
}

function proportionalByType(total: number, weights: Record<JourneyEventType, number>) {
  const byType: Record<JourneyEventType, number> = {
    search: 0,
    view: 0,
    like: 0,
    dislike: 0,
    watchlist: 0,
    watched: 0,
  };

  if (total <= 0) return byType;

  const weightTotal = Object.values(weights).reduce((sum, value) => sum + value, 0);
  if (weightTotal <= 0) {
    byType.view = total;
    return byType;
  }

  let assigned = 0;
  const remainders: Array<{ type: JourneyEventType; remainder: number }> = [];

  (Object.keys(byType) as JourneyEventType[]).forEach((type) => {
    const raw = (total * weights[type]) / weightTotal;
    const floor = Math.floor(raw);
    byType[type] = floor;
    assigned += floor;
    remainders.push({ type, remainder: raw - floor });
  });

  // Distribute rounding leftovers to the largest remainders to keep totals exact.
  let remaining = total - assigned;
  remainders.sort((a, b) => b.remainder - a.remainder);
  let idx = 0;
  while (remaining > 0) {
    const target = remainders[idx % remainders.length];
    byType[target.type] += 1;
    idx += 1;
    remaining -= 1;
  }

  return byType;
}

function mapDashboardToJourney(data: DashboardApiResponse, days: number): JourneyTimelineResponse {
  const safeDays = Math.min(Math.max(days, 7), 120);

  const summaryTotal = data.summary.total_interactions || 0;
  const searchCount = data.summary.searches || 0;
  const likeCount = data.summary.likes || 0;
  const dislikeCount = data.summary.dislikes || 0;
  const watchedCount = data.summary.watched || 0;
  const watchlistCount = data.summary.watchlist_total || 0;

  // Views are estimated as the remainder of interactions not captured by explicit typed counters.
  const knownTypedCount = searchCount + likeCount + dislikeCount + watchedCount + watchlistCount;
  const viewCount = Math.max(summaryTotal - knownTypedCount, 0);

  const weights: Record<JourneyEventType, number> = {
    search: searchCount,
    view: viewCount,
    like: likeCount,
    dislike: dislikeCount,
    watchlist: watchlistCount,
    watched: watchedCount,
  };

  const timeline = data.activity_timeline.map((point) => ({
    date: point.date,
    total: point.count,
    by_type: proportionalByType(point.count, weights),
  }));

  const typeTotals = [
    { type: "search" as const, count: searchCount },
    { type: "view" as const, count: viewCount },
    { type: "like" as const, count: likeCount },
    { type: "dislike" as const, count: dislikeCount },
    { type: "watchlist" as const, count: watchlistCount },
    { type: "watched" as const, count: watchedCount },
  ];

  const topType = [...typeTotals].sort((a, b) => b.count - a.count)[0] || {
    type: "view" as const,
    count: 0,
  };

  const mostActiveDay = timeline.length
    ? [...timeline].sort((a, b) => b.total - a.total)[0]
    : null;

  const recentEvents = (data.recent_activity || []).map((event) => ({
    type: event.interaction_type,
    movie_tmdb_id: event.movie_tmdb_id || 0,
    movie_title: event.movie_title,
    date: event.created_at,
  }));

  return {
    window_days: safeDays,
    summary: {
      total_events: data.summary.total_interactions || 0,
      active_days: timeline.filter((day) => day.total > 0).length,
      activity_streak_days: 0,
      most_active_day: mostActiveDay || null,
      top_interaction_type: topType.type,
      top_interaction_count: topType.count,
    },
    type_totals: typeTotals,
    timeline,
    recent_events: recentEvents,
    insights: [
      "Journey compatibility mode is active while the dedicated journey API is unavailable.",
      `Tracked ${summaryTotal} events in the selected window.`,
    ],
  };
}

// Token Management

let accessToken: string | null = null;
let refreshToken: string | null = null;

export function setTokens(tokens: AuthTokens) {
  accessToken = tokens.access;
  refreshToken = tokens.refresh;
  if (typeof window !== "undefined") {
    sessionStorage.setItem("cq_access", tokens.access);
    sessionStorage.setItem("cq_refresh", tokens.refresh);
  }
}

export function loadTokens() {
  if (typeof window !== "undefined") {
    accessToken = sessionStorage.getItem("cq_access");
    refreshToken = sessionStorage.getItem("cq_refresh");
  }
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
  if (typeof window !== "undefined") {
    sessionStorage.removeItem("cq_access");
    sessionStorage.removeItem("cq_refresh");
  }
}

// Fetch Wrapper

async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401 && refreshToken) {
    // refreshing token
    const refreshRes = await fetch(`${API_BASE}/auth/token/refresh/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (refreshRes.ok) {
      const data = await refreshRes.json();
      setTokens({ access: data.access, refresh: refreshToken! });
      headers["Authorization"] = `Bearer ${data.access}`;

      const retryRes = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
      });
      if (!retryRes.ok) throw new Error(`API error: ${retryRes.status}`);
      return retryRes.json();
    } else {
      clearTokens();
      throw new Error("Session expired. Please log in again.");
    }
  }

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

// Auth API

export const authAPI = {
  login: async (username: string, password: string) => {
    const tokens = await apiFetch<AuthTokens>("/auth/token/", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    setTokens(tokens);
    return tokens;
  },

  register: async (username: string, email: string, password: string) => {
    return apiFetch<User>("/users/register/", {
      method: "POST",
      body: JSON.stringify({ username, email, password, password_confirm: password }),
    });
  },

  getProfile: () => apiFetch<User>("/users/profile/"),

  updateProfile: (data: Partial<User>) =>
    apiFetch<User>("/users/profile/", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
};

// Movies API

export const moviesAPI = {
  search: (query: string, page = 1) =>
    apiFetch<PaginatedResponse<MovieCompact>>(
      `/movies/search/?q=${encodeURIComponent(query)}&page=${page}`
    ),

  trending: (window = "week", page = 1) =>
    apiFetch<PaginatedResponse<MovieCompact>>(
      `/movies/trending/?window=${window}&page=${page}`
    ),

  nowPlaying: (page = 1) =>
    apiFetch<PaginatedResponse<MovieCompact>>(`/movies/now-playing/?page=${page}`),

  topRated: (page = 1) =>
    apiFetch<PaginatedResponse<MovieCompact>>(`/movies/top-rated/?page=${page}`),

  getDetail: (tmdbId: number) => apiFetch<any>(`/movies/tmdb/${tmdbId}/`),

  getRecommendations: (movieId: number) =>
    apiFetch<MovieCompact[]>(`/movies/list/${movieId}/recommendations/`),

  getSimilar: (movieId: number) =>
    apiFetch<MovieCompact[]>(`/movies/list/${movieId}/similar/`),

  getWikipedia: (movieId: number) =>
    apiFetch<{ summary: string; url: string }>(`/movies/list/${movieId}/wikipedia/`),

  getMoods: () => apiFetch<any[]>("/movies/moods/"),

  getMoodMovies: (slug: string, page = 1) =>
    apiFetch<any>(`/movies/moods/${slug}/?page=${page}`),

  discover: (params: Record<string, string | number>) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== "" && v !== undefined && v !== null) qs.set(k, String(v));
    });
    return apiFetch<PaginatedResponse<MovieCompact>>(`/movies/discover/?${qs.toString()}`);
  },

  compare: (id1: number, id2: number) =>
    apiFetch<{ movies: any[] }>(`/movies/compare/?ids=${id1},${id2}`),
};

// Genres API

export const genresAPI = {
  list: () => apiFetch<Genre[]>("/movies/genres/"),

  getMovies: (slug: string, page = 1, sort = "popularity.desc") =>
    apiFetch<PaginatedResponse<MovieCompact>>(
      `/movies/genres/${slug}/movies/?page=${page}&sort=${sort}`
    ),
};

// People API

export const peopleAPI = {
  search: (query: string) =>
    apiFetch<any>(`/movies/people/search/?q=${encodeURIComponent(query)}`),

  getDetail: (id: number) => apiFetch<Person>(`/movies/people/${id}/`),

  enrich: (id: number) => apiFetch<Person>(`/movies/people/${id}/enrich/`),
};

// Recommendations API

export const recommendationsAPI = {
  forYou: (page = 1) =>
    apiFetch<PaginatedResponse<MovieCompact>>(`/recommendations/for-you/?page=${page}`),

  becauseYouWatched: () =>
    apiFetch<Record<string, MovieCompact[]>>("/recommendations/because-you-watched/"),

  getPreferences: () =>
    apiFetch<GenrePreference[]>("/recommendations/preferences/"),

  trackInteraction: (data: {
    movie_tmdb_id: number;
    movie_title: string;
    interaction_type: string;
    genre_ids?: number[];
    rating?: number;
  }) =>
    apiFetch("/recommendations/track/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getWatchlist: () => apiFetch<WatchlistItem[]>("/recommendations/watchlist/"),

  addToWatchlist: (data: {
    movie_tmdb_id: number;
    movie_title: string;
    poster_path: string;
  }) =>
    apiFetch<WatchlistItem>("/recommendations/watchlist/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  markWatched: (id: number) =>
    apiFetch<WatchlistItem>(`/recommendations/watchlist/${id}/mark_watched/`, {
      method: "POST",
    }),

  removeFromWatchlist: (id: number) =>
    apiFetch(`/recommendations/watchlist/${id}/`, { method: "DELETE" }),

  getDashboard: () => apiFetch<any>("/recommendations/dashboard/"),

  getJourneyTimeline: async (days = 30) => {
    const safeDays = Math.min(Math.max(days, 7), 120);
    const endpointAvailability = getJourneyEndpointAvailability();

    if (endpointAvailability === false) {
      const dashboard = await apiFetch<DashboardApiResponse>("/recommendations/dashboard/");
      return mapDashboardToJourney(dashboard, safeDays);
    }

    try {
      const journey = await apiFetch<JourneyTimelineResponse>(`/recommendations/journey/?days=${safeDays}`);
      setJourneyEndpointAvailability(true);
      return journey;
    } catch (error) {
      if (error instanceof Error && error.message.includes("404")) {
        setJourneyEndpointAvailability(false);
        const dashboard = await apiFetch<DashboardApiResponse>("/recommendations/dashboard/");
        return mapDashboardToJourney(dashboard, safeDays);
      }
      throw error;
    }
  },
};