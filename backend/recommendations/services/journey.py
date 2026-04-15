from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import timedelta

from django.db.models import Count
from django.db.models.functions import TruncDate
from django.utils import timezone

from recommendations.models import UserMovieInteraction, Watchlist


@dataclass(frozen=True)
class JourneyWindow:
    days: int = 30

    @property
    def start(self):
        return timezone.now() - timedelta(days=self.days)


class JourneyTimelineService:
    """Builds timeline and insight payloads for a user's movie activity journey."""

    EVENT_TYPES = ("search", "view", "like", "dislike", "watchlist", "watched")

    def _build_zeroed_type_map(self) -> dict[str, int]:
        return {event_type: 0 for event_type in self.EVENT_TYPES}

    def _iter_dates(self, window: JourneyWindow):
        start_date = window.start.date()
        end_date = timezone.now().date()
        span_days = (end_date - start_date).days

        for offset in range(span_days + 1):
            yield start_date + timedelta(days=offset)

    def _collect_interaction_rows(self, user, window: JourneyWindow):
        return (
            UserMovieInteraction.objects.filter(user=user, created_at__gte=window.start)
            .annotate(day=TruncDate("created_at"))
            .values("day", "interaction_type")
            .annotate(count=Count("id"))
            .order_by("day")
        )

    def _collect_watchlist_rows(self, user, window: JourneyWindow):
        return (
            Watchlist.objects.filter(user=user, added_at__gte=window.start)
            .annotate(day=TruncDate("added_at"))
            .values("day")
            .annotate(count=Count("id"))
            .order_by("day")
        )

    def _build_daily_index(self, user, window: JourneyWindow) -> dict:
        daily_index = {
            date_value: {"total": 0, "by_type": self._build_zeroed_type_map()}
            for date_value in self._iter_dates(window)
        }

        for row in self._collect_interaction_rows(user, window):
            day = row["day"]
            event_type = row["interaction_type"]
            count = row["count"]
            if day not in daily_index or event_type not in daily_index[day]["by_type"]:
                continue
            daily_index[day]["by_type"][event_type] += count
            daily_index[day]["total"] += count

        # Watchlist model acts as a source-of-truth fallback for add events.
        # This covers cases where adding to watchlist was not tracked as an interaction event.
        for row in self._collect_watchlist_rows(user, window):
            day = row["day"]
            count = row["count"]
            if day not in daily_index:
                continue
            daily_index[day]["by_type"]["watchlist"] += count
            daily_index[day]["total"] += count

        return daily_index

    def _build_timeline(self, daily_index: dict) -> list[dict]:
        timeline = []
        for day in sorted(daily_index.keys()):
            item = daily_index[day]
            timeline.append(
                {
                    "date": str(day),
                    "total": item["total"],
                    "by_type": item["by_type"],
                }
            )
        return timeline

    def _build_type_totals(self, timeline: list[dict]) -> list[dict]:
        totals = defaultdict(int)
        for day in timeline:
            for event_type, count in day["by_type"].items():
                totals[event_type] += count

        return [
            {"type": event_type, "count": totals[event_type]}
            for event_type in self.EVENT_TYPES
        ]

    def _build_recent_events(self, user, window: JourneyWindow) -> list[dict]:
        recent_interactions = UserMovieInteraction.objects.filter(
            user=user,
            created_at__gte=window.start,
        ).order_by("-created_at")[:20]

        return [
            {
                "type": interaction.interaction_type,
                "movie_tmdb_id": interaction.movie_tmdb_id,
                "movie_title": interaction.movie_title,
                "date": interaction.created_at.isoformat(),
            }
            for interaction in recent_interactions
        ]

    def _build_summary(self, timeline: list[dict], type_totals: list[dict]) -> dict:
        total_events = sum(day["total"] for day in timeline)
        active_days = [day for day in timeline if day["total"] > 0]
        most_active_day = max(active_days, key=lambda x: x["total"]) if active_days else None

        top_type = max(type_totals, key=lambda x: x["count"]) if type_totals else {"type": "view", "count": 0}

        streak = 0
        current = 0
        for day in timeline:
            if day["total"] > 0:
                current += 1
                streak = max(streak, current)
            else:
                current = 0

        return {
            "total_events": total_events,
            "active_days": len(active_days),
            "activity_streak_days": streak,
            "most_active_day": most_active_day,
            "top_interaction_type": top_type["type"],
            "top_interaction_count": top_type["count"],
        }

    def _build_insights(self, summary: dict, type_totals: list[dict]) -> list[str]:
        if summary["total_events"] == 0:
            return ["No activity yet. Start searching and interacting with movies to build your journey timeline."]

        insights = [
            f"You logged {summary['total_events']} journey events across {summary['active_days']} active days.",
            f"Your strongest behavior is {summary['top_interaction_type']} with {summary['top_interaction_count']} actions.",
        ]

        if summary["activity_streak_days"] >= 3:
            insights.append(f"Great consistency: your longest activity streak is {summary['activity_streak_days']} days.")

        watched_total = next((item["count"] for item in type_totals if item["type"] == "watched"), 0)
        like_total = next((item["count"] for item in type_totals if item["type"] == "like"), 0)
        if watched_total > 0 and like_total > 0:
            insights.append("You are not just browsing; you actively complete and rate what you watch.")

        return insights

    def get_user_journey(self, user, days: int = 30) -> dict:
        safe_days = min(max(int(days), 7), 120)
        window = JourneyWindow(days=safe_days)

        daily_index = self._build_daily_index(user, window)
        timeline = self._build_timeline(daily_index)
        type_totals = self._build_type_totals(timeline)
        summary = self._build_summary(timeline, type_totals)
        recent_events = self._build_recent_events(user, window)

        return {
            "window_days": safe_days,
            "summary": summary,
            "type_totals": type_totals,
            "timeline": timeline,
            "recent_events": recent_events,
            "insights": self._build_insights(summary, type_totals),
        }