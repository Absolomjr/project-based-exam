"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  CalendarRange,
  Compass,
  Flame,
  Heart,
  LogIn,
  Search,
  ThumbsDown,
  Trophy,
  Tv,
  Eye,
  Bookmark,
} from "lucide-react";

import { recommendationsAPI } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import type {
  JourneyDailyPoint,
  JourneyTimelineResponse,
  JourneyTypeTotal,
} from "@/types/movie";

const WINDOW_OPTIONS = [7, 30, 90] as const;

const EVENT_STYLE: Record<string, { label: string; color: string; bg: string; icon: JSX.Element }> = {
  search: { label: "Searched", color: "text-sky-300", bg: "bg-sky-500/50", icon: <Search className="h-4 w-4" /> },
  view: { label: "Viewed", color: "text-blue-300", bg: "bg-blue-500/50", icon: <Eye className="h-4 w-4" /> },
  like: { label: "Liked", color: "text-emerald-300", bg: "bg-emerald-500/50", icon: <Heart className="h-4 w-4" /> },
  dislike: { label: "Disliked", color: "text-rose-300", bg: "bg-rose-500/50", icon: <ThumbsDown className="h-4 w-4" /> },
  watchlist: { label: "Watchlisted", color: "text-amber-300", bg: "bg-amber-500/50", icon: <Bookmark className="h-4 w-4" /> },
  watched: { label: "Watched", color: "text-violet-300", bg: "bg-violet-500/50", icon: <Tv className="h-4 w-4" /> },
};

const EMPTY_DATA: JourneyTimelineResponse = {
  window_days: 30,
  summary: {
    total_events: 0,
    active_days: 0,
    activity_streak_days: 0,
    most_active_day: null,
    top_interaction_type: "view",
    top_interaction_count: 0,
  },
  type_totals: [
    { type: "search", count: 0 },
    { type: "view", count: 0 },
    { type: "like", count: 0 },
    { type: "dislike", count: 0 },
    { type: "watchlist", count: 0 },
    { type: "watched", count: 0 },
  ],
  timeline: [],
  recent_events: [],
  insights: [],
};

function formatDay(date: string) {
  return new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function EventBar({ day, max }: { day: JourneyDailyPoint; max: number }) {
  const total = day.total || 0;
  const safeMax = Math.max(max, 1);
  const barHeight = Math.max((total / safeMax) * 100, total > 0 ? 5 : 0);

  if (total === 0) {
    return <div className="w-full h-full rounded-md bg-white/[0.03]" />;
  }

  let runningPercent = 0;
  const segments = Object.entries(day.by_type)
    .filter(([, count]) => count > 0)
    .map(([type, count]) => {
      const percent = (count / total) * 100;
      const segment = {
        type,
        bottom: runningPercent,
        height: percent,
      };
      runningPercent += percent;
      return segment;
    });

  return (
    <div className="w-full h-full rounded-md bg-white/[0.03] relative overflow-hidden" title={`${day.date}: ${day.total} events`}>
      <div className="absolute left-0 right-0 bottom-0 rounded-md overflow-hidden" style={{ height: `${barHeight}%` }}>
        {segments.map((segment) => (
          <div
            key={`${day.date}-${segment.type}`}
            className={`absolute left-0 right-0 ${EVENT_STYLE[segment.type].bg}`}
            style={{
              bottom: `${segment.bottom}%`,
              height: `${segment.height}%`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default function JourneyPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [windowDays, setWindowDays] = useState<number>(30);
  const [data, setData] = useState<JourneyTimelineResponse>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    async function loadJourney() {
      setLoading(true);
      setError(null);
      try {
        const response = await recommendationsAPI.getJourneyTimeline(windowDays);
        setData(response);
      } catch {
        setError("Could not load your journey timeline right now.");
      } finally {
        setLoading(false);
      }
    }

    loadJourney();
  }, [isAuthenticated, windowDays]);

  const maxDaily = useMemo(() => Math.max(...data.timeline.map((point) => point.total), 1), [data.timeline]);

  const sortedTypeTotals = useMemo(
    () => [...data.type_totals].sort((a, b) => b.count - a.count),
    [data.type_totals]
  );

  if (!authLoading && !isAuthenticated) {
    return (
      <div className="pt-24 pb-20 px-6 md:px-10 lg:px-20 max-w-[1440px] mx-auto">
        <div className="max-w-md mx-auto text-center py-20">
          <div className="w-16 h-16 rounded-2xl glass-card flex items-center justify-center mx-auto mb-6">
            <CalendarRange className="w-8 h-8 text-gold/30" />
          </div>
          <h1 className="text-3xl font-bold font-display mb-3">Movie Journey Timeline</h1>
          <p className="text-white/30 mb-6">
            Sign in to view your personal timeline across searches, views, likes, watchlist events, and watched movies.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-gold to-gold-dim text-surface-0 font-semibold text-sm"
          >
            <LogIn className="w-4 h-4" />
            Sign in to continue
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-24 pb-20 px-6 md:px-10 lg:px-20 max-w-[1440px] mx-auto space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-gold/70">New Feature</p>
          <h1 className="text-3xl font-bold font-display mt-1">Movie Journey Timeline</h1>
          <p className="text-sm text-white/35 mt-2">
            A visual history of your movie actions with trends, streaks, and activity insights.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 p-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          {WINDOW_OPTIONS.map((days) => (
            <button
              key={days}
              onClick={() => setWindowDays(days)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                windowDays === days ? "bg-gold text-surface-0" : "text-white/60 hover:bg-white/10"
              }`}
            >
              {days} days
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="space-y-4">
          <div className="skeleton h-24 rounded-xl" />
          <div className="skeleton h-72 rounded-xl" />
          <div className="skeleton h-52 rounded-xl" />
        </div>
      )}

      {!loading && error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>
      )}

      {!loading && !error && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="glass-card rounded-xl p-4">
              <p className="text-xs text-white/35">Total Events</p>
              <p className="text-2xl font-bold font-display mt-1">{data.summary.total_events}</p>
            </div>
            <div className="glass-card rounded-xl p-4">
              <p className="text-xs text-white/35">Active Days</p>
              <p className="text-2xl font-bold font-display mt-1">{data.summary.active_days}</p>
            </div>
            <div className="glass-card rounded-xl p-4">
              <p className="text-xs text-white/35">Best Streak</p>
              <p className="text-2xl font-bold font-display mt-1">{data.summary.activity_streak_days}</p>
            </div>
            <div className="glass-card rounded-xl p-4">
              <p className="text-xs text-white/35">Top Action</p>
              <p className="text-2xl font-bold font-display mt-1 capitalize">{data.summary.top_interaction_type}</p>
            </div>
          </div>

          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-gold" />
              <h2 className="text-lg font-bold font-display">Daily Activity Timeline</h2>
            </div>

            {data.timeline.length === 0 ? (
              <p className="text-sm text-white/30 py-8 text-center">
                No activity in this range yet. Explore movies to start building your journey.
              </p>
            ) : (
              <>
                <div className="h-56 flex items-end gap-1">
                  {data.timeline.map((day) => (
                    <div key={day.date} className="flex-1 h-full">
                      <EventBar day={day} max={maxDaily} />
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-[10px] text-white/20 mt-2">
                  <span>{formatDay(data.timeline[0].date)}</span>
                  <span>{formatDay(data.timeline[data.timeline.length - 1].date)}</span>
                </div>
                <div className="flex flex-wrap gap-2 mt-4">
                  {Object.entries(EVENT_STYLE).map(([type, style]) => (
                    <div key={type} className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                      <span className={style.color}>{style.icon}</span>
                      <span className="text-xs text-white/65">{style.label}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass-card rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="w-4 h-4 text-gold" />
                <h2 className="text-lg font-bold font-display">Activity Breakdown</h2>
              </div>
              <div className="space-y-3">
                {sortedTypeTotals.map((item: JourneyTypeTotal) => (
                  <div key={item.type} className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${EVENT_STYLE[item.type].bg}`}>
                      <span className={EVENT_STYLE[item.type].color}>{EVENT_STYLE[item.type].icon}</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-white/75">{EVENT_STYLE[item.type].label}</p>
                    </div>
                    <span className="text-sm font-semibold text-white/80">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Flame className="w-4 h-4 text-gold" />
                <h2 className="text-lg font-bold font-display">Journey Insights</h2>
              </div>
              <div className="space-y-3">
                {data.insights.map((insight) => (
                  <div key={insight} className="text-sm text-white/70 bg-white/[0.03] border border-white/[0.05] rounded-lg p-3">
                    {insight}
                  </div>
                ))}
                {data.summary.most_active_day && (
                  <div className="text-sm text-white/65 bg-gold/10 border border-gold/20 rounded-lg p-3">
                    Most active day: {formatDay(data.summary.most_active_day.date)} ({data.summary.most_active_day.total} events)
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Compass className="w-4 h-4 text-gold" />
              <h2 className="text-lg font-bold font-display">Recent Timeline Events</h2>
            </div>
            {data.recent_events.length === 0 ? (
              <p className="text-sm text-white/30">No recent events available yet.</p>
            ) : (
              <div className="space-y-2">
                {data.recent_events.slice(0, 12).map((event, index) => (
                  <div
                    key={`${event.date}-${index}`}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.05]"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs ${EVENT_STYLE[event.type].bg} ${EVENT_STYLE[event.type].color}`}>
                        {EVENT_STYLE[event.type].label}
                      </span>
                      {event.movie_tmdb_id > 0 ? (
                        <Link href={`/movie/${event.movie_tmdb_id}`} className="text-sm text-white/70 hover:text-gold transition-colors">
                          {event.movie_title}
                        </Link>
                      ) : (
                        <span className="text-sm text-white/70">{event.movie_title}</span>
                      )}
                    </div>
                    <span className="text-[11px] text-white/25">{new Date(event.date).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}