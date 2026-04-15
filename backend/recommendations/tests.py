from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from recommendations.models import UserMovieInteraction, Watchlist

User = get_user_model()


class JourneyTimelineEndpointTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="journey_user", password="password123")

    def test_journey_endpoint_requires_authentication(self):
        response = self.client.get("/api/recommendations/journey/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_journey_endpoint_returns_timeline_payload(self):
        self.client.force_authenticate(user=self.user)

        UserMovieInteraction.objects.create(
            user=self.user,
            movie_tmdb_id=550,
            movie_title="Fight Club",
            interaction_type="search",
            genre_ids=[18],
        )
        UserMovieInteraction.objects.create(
            user=self.user,
            movie_tmdb_id=550,
            movie_title="Fight Club",
            interaction_type="like",
            genre_ids=[18],
        )
        Watchlist.objects.create(
            user=self.user,
            movie_tmdb_id=680,
            movie_title="Pulp Fiction",
            poster_path="/poster.jpg",
        )

        response = self.client.get("/api/recommendations/journey/?days=30")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("summary", response.data)
        self.assertIn("timeline", response.data)
        self.assertIn("type_totals", response.data)
        self.assertIn("recent_events", response.data)
        self.assertIn("insights", response.data)
        self.assertGreaterEqual(response.data["summary"]["total_events"], 2)

    def test_journey_days_parameter_is_safely_clamped(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get("/api/recommendations/journey/?days=500")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["window_days"], 120)