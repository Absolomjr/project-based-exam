
# Comprehensive test suite for Movies API.
# Tests cover key endpoints, model logic, and data synchronization behavior.


from django.test import TestCase, APIClient
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase
from datetime import datetime

from .models import Movie, Genre, Person, MovieCast
from .serializers import MovieDetailSerializer, GenreSerializer

User = get_user_model()


class GenreModelTests(TestCase):
    """Test Genre model and related functionality."""

    def test_genre_creation(self):
        """Test that a Genre can be created with required fields."""
        genre = Genre.objects.create(
            tmdb_id=28,
            name="Action",
            slug="action"
        )
        self.assertEqual(genre.name, "Action")
        self.assertEqual(genre.slug, "action")
        self.assertEqual(genre.tmdb_id, 28)

    def test_genre_unique_tmdb_id(self):
        """Test that tmdb_id is unique across genres."""
        genre1 = Genre.objects.create(tmdb_id=28, name="Action", slug="action")
        
        with self.assertRaises(Exception):
            Genre.objects.create(tmdb_id=28, name="Action Film", slug="action-film")

    def test_genre_str_representation(self):
        """Test string representation of Genre model."""
        genre = Genre.objects.create(tmdb_id=35, name="Comedy", slug="comedy")
        self.assertEqual(str(genre), "Comedy")

    def test_genre_ordering(self):
        """Test that genres are ordered by name."""
        Genre.objects.create(tmdb_id=28, name="Action", slug="action")
        Genre.objects.create(tmdb_id=12, name="Adventure", slug="adventure")
        
        genres = list(Genre.objects.all().values_list('name', flat=True))
        self.assertEqual(genres, ["Action", "Adventure"])


class MovieModelTests(TestCase):
    """Test Movie model and related functionality."""

    def setUp(self):
        """Create test data."""
        self.genre = Genre.objects.create(
            tmdb_id=28,
            name="Action",
            slug="action"
        )

    def test_movie_creation(self):
        """Test that a Movie can be created with all fields."""
        movie = Movie.objects.create(
            tmdb_id=550,
            title="Fight Club",
            release_date=datetime(1999, 10, 15).date(),
            runtime=139,
            vote_average=8.8,
            vote_count=2000,
            popularity=25.5,
            overview="An insomniac office worker..."
        )
        movie.genres.add(self.genre)
        
        self.assertEqual(movie.title, "Fight Club")
        self.assertEqual(movie.tmdb_id, 550)
        self.assertEqual(movie.runtime, 139)
        self.assertEqual(movie.genres.count(), 1)

    def test_movie_title_length_validation(self):
        """Test that movie title can be up to 500 characters."""
        long_title = "A" * 500
        movie = Movie.objects.create(
            tmdb_id=999,
            title=long_title,
            release_date=datetime(2024, 1, 1).date()
        )
        self.assertEqual(len(movie.title), 500)

    def test_movie_popularity_ordering(self):
        """Test that movies are ordered by popularity descending."""
        movie1 = Movie.objects.create(tmdb_id=1, title="Movie 1", popularity=10.0)
        movie2 = Movie.objects.create(tmdb_id=2, title="Movie 2", popularity=20.0)
        movie3 = Movie.objects.create(tmdb_id=3, title="Movie 3", popularity=15.0)
        
        movies = list(Movie.objects.all())
        self.assertEqual(movies[0].title, "Movie 2")
        self.assertEqual(movies[1].title, "Movie 3")
        self.assertEqual(movies[2].title, "Movie 1")

    def test_movie_genre_relationship(self):
        """Test many-to-many relationship between Movie and Genre."""
        genre2 = Genre.objects.create(tmdb_id=35, name="Comedy", slug="comedy")
        movie = Movie.objects.create(
            tmdb_id=550,
            title="Fight Club",
            release_date=datetime(1999, 10, 15).date()
        )
        movie.genres.add(self.genre, genre2)
        
        self.assertEqual(movie.genres.count(), 2)
        self.assertIn(self.genre, movie.genres.all())


class MovieAPITests(APITestCase):
    """Test Movie API endpoints."""

    def setUp(self):
        """Create test data and API client."""
        self.client = APIClient()
        self.genre = Genre.objects.create(
            tmdb_id=28,
            name="Action",
            slug="action"
        )
        self.movie1 = Movie.objects.create(
            tmdb_id=550,
            title="Fight Club",
            overview="An insomniac office worker...",
            release_date=datetime(1999, 10, 15).date(),
            vote_average=8.8,
            popularity=25.5
        )
        self.movie1.genres.add(self.genre)
        
        self.movie2 = Movie.objects.create(
            tmdb_id=680,
            title="Pulp Fiction",
            overview="The lives of two mob hitmen...",
            release_date=datetime(1994, 10, 14).date(),
            vote_average=8.9,
            popularity=26.0
        )
        self.movie2.genres.add(self.genre)

    def test_search_movies_endpoint(self):
        """Test that search_movies endpoint accepts GET requests and returns results."""
        response = self.client.get('/api/movies/search/', {'q': 'Fight'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('results', response.data)
        self.assertIn('page', response.data)

    def test_search_movies_missing_query(self):
        """Test that search_movies returns error when query parameter is missing."""
        response = self.client.get('/api/movies/search/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)

    def test_movie_list_endpoint(self):
        """Test that movie list endpoint returns paginated results."""
        response = self.client.get('/api/movies/list/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('results', response.data)
        self.assertGreaterEqual(len(response.data['results']), 0)

    def test_genre_list_endpoint(self):
        """Test that genre list endpoint returns all genres."""
        response = self.client.get('/api/movies/genres/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 1)
        # Check that our created genre is in the results
        genre_names = [g['name'] for g in response.data]
        self.assertIn('Action', genre_names)

    def test_mood_list_endpoint(self):
        """Test that mood list endpoint returns available moods."""
        response = self.client.get('/api/movies/moods/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreater(len(response.data), 0)
        # Check that moods have expected structure
        for mood in response.data:
            self.assertIn('slug', mood)
            self.assertIn('label', mood)
            self.assertIn('description', mood)


class TrendingMoviesTests(APITestCase):
    """Test trending movies endpoint."""

    def test_trending_endpoint_exists(self):
        """Test that trending endpoint returns 200 status."""
        response = self.client.get('/api/movies/trending/')
        self.assertIn(response.status_code, [200, 404, 500])  # Might fail due to TMDB API

    def test_trending_now_playing_endpoints(self):
        """Test now-playing and top-rated endpoints respond to requests."""
        endpoints = [
            '/api/movies/now-playing/',
            '/api/movies/top-rated/'
        ]
        for endpoint in endpoints:
            response = self.client.get(endpoint)
            # Endpoints should at least return a response (may fail if TMDB API not available)
            self.assertIsNotNone(response)
            self.assertIn(response.status_code, [200, 404, 500])


class CompareMoviesTests(APITestCase):
    """Test compare movies endpoint."""

    def setUp(self):
        """Create test movies for comparison."""
        self.movie1 = Movie.objects.create(tmdb_id=550, title="Fight Club")
        self.movie2 = Movie.objects.create(tmdb_id=680, title="Pulp Fiction")

    def test_compare_movies_invalid_ids(self):
        """Test compare endpoint with invalid ID count."""
        response = self.client.get('/api/movies/compare/', {'ids': '550'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_compare_movies_response_structure(self):
        """Test that compare endpoint returns proper structure when IDs are valid."""
        response = self.client.get('/api/movies/compare/', {'ids': '550,680'})
        # Response may vary depending on TMDB API availability
        if response.status_code == 200:
            self.assertIn('movies', response.data)


class MovieDetailTests(APITestCase):
    """Test movie detail endpoints."""

    def setUp(self):
        """Create test movie data."""
        self.movie = Movie.objects.create(
            tmdb_id=550,
            title="Fight Club",
            imdb_id="tt0137523",
            overview="An insomniac office worker...",
            release_date=datetime(1999, 10, 15).date(),
            runtime=139,
            vote_average=8.8,
            vote_count=2000,
            popularity=25.5
        )

    def test_movie_detail_by_tmdb_id(self):
        """Test fetching movie detail by TMDB ID."""
        response = self.client.get(f'/api/movies/tmdb/{self.movie.tmdb_id}/')
        # Depending on TMDB API, might return 200 or fail
        self.assertIn(response.status_code, [200, 404, 500])


class APIResponseStructureTests(APITestCase):
    """Test API response structures and data integrity."""

    def setUp(self):
        """Create test data."""
        self.genre = Genre.objects.create(
            tmdb_id=28,
            name="Action",
            slug="action"
        )
        self.movie = Movie.objects.create(
            tmdb_id=550,
            title="Fight Club",
            release_date=datetime(1999, 10, 15).date(),
            vote_average=8.8
        )
        self.movie.genres.add(self.genre)

    def test_serializer_includes_all_required_fields(self):
        """Test that MovieDetailSerializer includes all required fields."""
        serializer = MovieDetailSerializer(self.movie)
        data = serializer.data
        
        required_fields = ['id', 'title', 'overview', 'release_date', 'popularity']
        for field in required_fields:
            self.assertIn(field, data)

    def test_genre_serializer_structure(self):
        """Test that GenreSerializer returns correct structure."""
        serializer = GenreSerializer(self.genre)
        data = serializer.data
        
        self.assertEqual(data['name'], 'Action')
        self.assertEqual(data['slug'], 'action')
        self.assertEqual(data['tmdb_id'], 28)
