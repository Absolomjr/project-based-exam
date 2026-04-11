"""
Movie Comparison Analytics Engine - Innovation Feature

This module provides advanced movie comparison, similarity scoring,
and comparative analytics for discovering related films.
"""

from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.db.models import Q
import math

from movies.models import Movie, Genre
from movies.serializers import MovieDetailSerializer


class MovieSimilarityEngine:
    """
    Engine for computing movie similarity scores.
    Analyzes genre, rating, release period, and popularity to find related films.
    """
   
    @staticmethod
    def calculate_genre_similarity(movie1_genres: set, movie2_genres: set) -> float:
        """
        Calculate genre-based similarity (0.0 to 1.0).
        Uses Jaccard similarity coefficient.
        """
        if not movie1_genres and not movie2_genres:
            return 1.0
       
        intersection = len(movie1_genres & movie2_genres)
        union = len(movie1_genres | movie2_genres)
       
        return intersection / union if union > 0 else 0.0
   
    @staticmethod
    def calculate_rating_similarity(rating1: float, rating2: float) -> float:
        """
        Calculate similarity based on ratings.
        Movies with similar quality ratings are more likely to appeal to same audience.
        """
        if rating1 == 0 or rating2 == 0:
            return 0.5
       
        # Scale to 0-10, then calculate similarity
        max_diff = 10.0
        diff = abs(rating1 - rating2)
        return 1.0 - (diff / max_diff)
   
    @staticmethod
    def calculate_year_similarity(year1: int, year2: int, max_gap=20) -> float:
        """
        Calculate similarity based on release year.
        Films from similar eras often share themes and styles.
        """
        if not year1 or not year2:
            return 0.5
       
        gap = abs(year1 - year2)
        return max(0.0, 1.0 - (gap / max_gap))
   
    @staticmethod
    def calculate_popularity_similarity(pop1: float, pop2: float) -> float:
        """
        Calculate similarity based on popularity scale.
        Prevents extreme mismatches in popularity levels.
        """
        if pop1 == 0 or pop2 == 0:
            return 0.5
       
        ratio = min(pop1, pop2) / max(pop1, pop2)
        return ratio
   
    @staticmethod
    def calculate_overall_similarity(movie1: Movie, movie2: Movie) -> float:
        """
        Calculate overall similarity score (0.0 to 1.0).
        Weighted combination of all factors.
        """
        # Get genre sets
        genres1 = set(movie1.genres.values_list('tmdb_id', flat=True))
        genres2 = set(movie2.genres.values_list('tmdb_id', flat=True))
       
        # Get release years
        year1 = movie1.release_date.year if movie1.release_date else None
        year2 = movie2.release_date.year if movie2.release_date else None
       
        # Calculate component scores
        genre_score = MovieSimilarityEngine.calculate_genre_similarity(genres1, genres2)
        rating_score = MovieSimilarityEngine.calculate_rating_similarity(
            movie1.vote_average,
            movie2.vote_average
        )
        year_score = MovieSimilarityEngine.calculate_year_similarity(year1, year2) if year1 and year2 else 0.5
        pop_score = MovieSimilarityEngine.calculate_popularity_similarity(
            movie1.popularity,
            movie2.popularity
        )
       
        # Weighted combination
        # Genre is most important (40%), then rating (30%), popularity (20%), year (10%)
        overall_score = (
            genre_score * 0.40 +
            rating_score * 0.30 +
            pop_score * 0.20 +
            year_score * 0.10
        )
       
        return round(overall_score, 2)


class ComparisonAnalytics:
    """Generates comparative analytics for multiple movies."""
   
    @staticmethod
    def generate_analytics(movies: list[Movie]) -> dict:
        """Generate comprehensive comparison analytics."""
        if not movies or len(movies) < 2:
            return {}
       
        analytics = {
            'count': len(movies),
            'average_rating': round(sum(m.vote_average for m in movies) / len(movies), 1),
            'average_runtime': sum(m.runtime or 0 for m in movies) // len(movies) if any(m.runtime for m in movies) else 0,
            'highest_rated': max(movies, key=lambda m: m.vote_average).title,
            'highest_rated_score': max(movies, key=lambda m: m.vote_average).vote_average,
            'most_popular': max(movies, key=lambda m: m.popularity).title,
            'year_range': {
                'start': min((m.release_date.year for m in movies if m.release_date), default=None),
                'end': max((m.release_date.year for m in movies if m.release_date), default=None),
            },
            'common_genres': ComparisonAnalytics._find_common_genres(movies),
            'similarity_matrixAnalytics': ComparisonAnalytics._calculate_similarity_matrix(movies),
        }
       
        return analytics
   
    @staticmethod
    def _find_common_genres(movies: list[Movie]) -> list[dict]:
        """Find genres common to all movies."""
        if not movies:
            return []
       
        # Start with genres of first movie
        common = set(movies[0].genres.values_list('id', flat=True))
       
        # Intersect with genres of other movies
        for movie in movies[1:]:
            movie_genres = set(movie.genres.values_list('id', flat=True))
            common &= movie_genres
       
        # Get genre details
        genres = Genre.objects.filter(id__in=common).values('id', 'name', 'slug')
        return list(genres)
   
    @staticmethod
    def _calculate_similarity_matrix(movies: list[Movie]) -> list[list[float]]:
        """Calculate pairwise similarity scores."""
        n = len(movies)
        matrix = [[0.0 for _ in range(n)] for _ in range(n)]
       
        for i in range(n):
            for j in range(n):
                if i == j:
                    matrix[i][j] = 1.0
                elif j > i:
                    score = MovieSimilarityEngine.calculate_overall_similarity(movies[i], movies[j])
                    matrix[i][j] = score
                    matrix[j][i] = score  # Symmetric
       
        return matrix


@api_view(['GET'])
@permission_classes([AllowAny])
def advanced_movie_comparison(request):
    """
    Advanced movie comparison endpoint with analytics.
   
    Query Parameters:
    - ids: Comma-separated list of TMDB IDs (up to 5)
    - include_analytics: Include detailed analytics (true/false)
   
    Returns:
    - movies: List of movie details
    - analytics: Comparative analysis
    - similarity_scores: Pairwise similarity between movies
    """
   
    ids_str = request.query_params.get('ids', '')
    include_analytics = request.query_params.get('include_analytics', 'true').lower() == 'true'
   
    # Parse IDs
    try:
        movie_ids = [int(i.strip()) for i in ids_str.split(',') if i.strip().isdigit()]
    except ValueError:
        return Response(
            {'error': 'Invalid movie IDs provided'},
            status=400
        )
   
    # Validate count
    if len(movie_ids) < 2:
        return Response(
            {'error': 'Please provide at least 2 movie IDs'},
            status=400
        )
   
    if len(movie_ids) > 5:
        return Response(
            {'error': 'Maximum 5 movies can be compared'},
            status=400
        )
   
    # Fetch movies
    movies = Movie.objects.filter(tmdb_id__in=movie_ids).prefetch_related('genres')
   
    if not movies.exists():
        return Response(
            {'error': 'No movies found with provided IDs'},
            status=404
        )
   
    # Serialize movies
    serializer = MovieDetailSerializer(movies, many=True)
   
    response_data = {
        'movies': serializer.data,
        'count': movies.count(),
    }
   
    # Add analytics if requested
    if include_analytics and movies.count() >= 2:
        analytics = ComparisonAnalytics.generate_analytics(list(movies))
        response_data['analytics'] = analytics
       
        # Add pairwise similarity scores with labels
        movie_list = list(movies)
        response_data['pairwise_similarity'] = []
       
        for i, movie1 in enumerate(movie_list):
            for j, movie2 in enumerate(movie_list[i+1:], start=i+1):
                similarity = MovieSimilarityEngine.calculate_overall_similarity(movie1, movie2)
                response_data['pairwise_similarity'].append({
                    'movie1': movie1.title,
                    'movie2': movie2.title,
                    'similarity_score': similarity,
                    'match_percentage': int(similarity * 100),
                    'recommendation': MovieSimilarityEngine._get_similarity_description(similarity),
                })
   
    return Response(response_data)


@api_view(['GET'])
@permission_classes([AllowAny])
def discover_similar_movies(request, tmdb_id):
    """
    Discover movies similar to a given movie.
   
    Query Parameters:
    - limit: Number of similar movies to return (default: 10, max: 20)
   
    Returns:
    - source_movie: The reference movie
    - similar_movies: List of ranked similar movies with similarity scores
    """
   
    try:
        limit = int(request.query_params.get('limit', 10))
        limit = min(max(limit, 5), 20)  # Clamp between 5 and 20
    except ValueError:
        limit = 10
   
    # Get source movie
    try:
        source_movie = Movie.objects.get(tmdb_id=tmdb_id)
    except Movie.DoesNotExist:
        return Response(
            {'error': 'Movie not found'},
            status=404
        )
   
    # Get potentially similar movies (same genres or similar ratings)
    source_genres = source_movie.genres.all()
    source_year = source_movie.release_date.year if source_movie.release_date else None
   
    # Query: Same genres OR similar rating OR similar era
    similar_movies_query = Movie.objects.filter(
        Q(genres__in=source_genres) |
        Q(vote_average__gte=source_movie.vote_average - 1,
          vote_average__lte=source_movie.vote_average + 1)
    ).exclude(id=source_movie.id).prefetch_related('genres').distinct()
   
    # Calculate similarity scores and sort
    similarity_scores = []
    for movie in similar_movies_query:
        score = MovieSimilarityEngine.calculate_overall_similarity(source_movie, movie)
        similarity_scores.append((movie, score))
   
    # Sort by similarity score descending
    similarity_scores.sort(key=lambda x: x[1], reverse=True)
   
    # Take top N
    top_similar = similarity_scores[:limit]
   
    # Prepare response
    similar_with_scores = [
        {
            **MovieDetailSerializer(movie).data,
            'similarity_score': round(score, 2),
            'match_percentage': int(score * 100),
        }
        for movie, score in top_similar
    ]
   
    return Response({
        'source_movie': MovieDetailSerializer(source_movie).data,
        'similar_count': len(similar_with_scores),
        'similar_movies': similar_with_scores,
    })


# Helper functions for similarity descriptions
def _get_similarity_description(score: float) -> str:
    """Get human-readable description of similarity."""
    if score >= 0.85:
        return "Highly Similar"
    elif score >= 0.70:
        return "Very Similar"
    elif score >= 0.55:
        return "Similar"
    elif score >= 0.40:
        return "Moderately Related"
    else:
        return "Distantly Related"


# Attach helper to engine class
MovieSimilarityEngine._get_similarity_description = staticmethod(_get_similarity_description)
