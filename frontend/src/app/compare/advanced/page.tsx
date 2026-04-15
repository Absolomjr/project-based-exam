"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Star, TrendingUp, Zap, BarChart3, Layers } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { moviesAPI } from "@/lib/api";
import { posterUrl } from "@/lib/utils";

/**
 * Enhanced Movie Comparison Page with Analytics
 * 
 * Features:
 * - Compare up to 5 movies simultaneously
 * - Visual similarity scoring
 * - Comparative analytics (ratings, genres, years)
 * - Pairwise similarity analysis
 * - Personalized recommendations based on comparison
 */
export default function AdvancedComparePage() {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [comparisonData, setComparisonData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");

  // Perform comparison
  async function performComparison() {
    if (selectedIds.length < 2) {
      setError("Please select at least 2 movies to compare");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Call the analytics endpoint if we have a custom API method, otherwise use compare
      const ids = selectedIds.join(",");
      // Note: This assumes the API has been extended with analytics endpoint
      // For now, use the basic compare endpoint
      const response = await fetch(
        `/api/movies/analytics/compare/?ids=${ids}&include_analytics=true`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch comparison data");
      }

      const data = await response.json();
      setComparisonData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Comparison failed");
      setComparisonData(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen pb-24 pt-24">
      {/* Header */}
      <div className="max-w-6xl mx-auto px-6 md:px-10 mb-12">
        <Link
          href="/search"
          className="inline-flex items-center gap-2 text-sm text-white/30 hover:text-white/60 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        <div className="flex items-center gap-4 mb-8">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gold to-gold-dim flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-surface-0" />
          </div>
          <div>
            <h1 className="text-4xl md:text-5xl font-bold font-display">
              Movie Analytics
            </h1>
            <p className="text-white/30 text-sm mt-2">
              Compare up to 5 movies and discover deep analytics
            </p>
          </div>
        </div>
      </div>

      {/* Input Section */}
      <div className="max-w-6xl mx-auto px-6 md:px-10 mb-12">
        <div className="glass-card rounded-2xl p-8">
          <h2 className="text-xl font-semibold mb-6 text-white/90">
            Select Movies to Compare
          </h2>

          {/* Movie Selection */}
          <div className="space-y-4 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="relative">
                  <input
                    type="number"
                    placeholder={`Movie ${i + 1} TMDB ID (optional)`}
                    className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg px-4 py-3 text-white placeholder:text-white/20 focus:outline-none focus:border-gold/20"
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      const newIds = [...selectedIds];
                      if (val > 0) {
                        newIds[i] = val;
                      } else {
                        newIds.splice(i, 1);
                      }
                      setSelectedIds(newIds.filter((id) => id > 0));
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Quick Examples */}
          <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-4 mb-6">
            <p className="text-xs text-white/40 mb-3 font-semibold uppercase">
              Popular TMDB IDs to try:
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 550, title: "Fight Club" },
                { id: 680, title: "Pulp Fiction" },
                { id: 278, title: "Shawshank Redemption" },
                { id: 238, title: "The Godfather" },
                { id: 240, title: "The Godfather II" },
              ].map((movie) => (
                <button
                  key={movie.id}
                  onClick={() => {
                    if (!selectedIds.includes(movie.id)) {
                      setSelectedIds([...selectedIds, movie.id]);
                    }
                  }}
                  className="text-xs px-3 py-1.5 rounded-lg bg-gold/10 border border-gold/20 text-gold/80 hover:border-gold/40 hover:text-gold transition-all"
                >
                  {movie.title}
                </button>
              ))}
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Action Button */}
          <button
            onClick={performComparison}
            disabled={selectedIds.length < 2 || loading}
            className={`w-full py-3 rounded-lg font-semibold transition-all ${
              selectedIds.length < 2 || loading
                ? "bg-white/[0.02] text-white/30 cursor-not-allowed"
                : "bg-gradient-to-r from-gold to-gold-dim text-surface-0 hover:shadow-lg hover:shadow-gold/20"
            }`}
          >
            {loading ? "Comparing..." : `Compare ${selectedIds.length} Movie${selectedIds.length !== 1 ? "s" : ""}`}
          </button>
        </div>
      </div>

      {/* Comparison Results */}
      {comparisonData && (
        <div className="max-w-6xl mx-auto px-6 md:px-10 space-y-12">
          {/* Movies Grid */}
          <div className="space-y-6">
            <h3 className="text-2xl font-bold">Selected Movies</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {comparisonData.movies?.map((movie: any) => (
                <Link
                  key={movie.id}
                  href={`/movie/${movie.tmdb_id}`}
                  className="group glass-card rounded-xl overflow-hidden hover:border-gold/20 transition-all duration-300"
                >
                  <div className="aspect-[2/3] relative rounded-lg overflow-hidden mb-4">
                    {movie.poster_url && (
                      <Image
                        src={posterUrl(movie.poster_url)}
                        alt={movie.title}
                        fill
                        className="object-cover group-hover:scale-110 transition-transform duration-500"
                        unoptimized
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent" />
                  </div>
                  <div className="p-4">
                    <h4 className="font-semibold truncate group-hover:text-gold transition-colors">
                      {movie.title}
                    </h4>
                    <div className="flex items-center gap-2 mt-2 text-sm text-white/60">
                      <Star className="w-4 h-4 fill-gold text-gold" />
                      <span className="text-gold">{movie.vote_average.toFixed(1)}</span>
                      <span>• {movie.year}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Analytics Section */}
          {comparisonData.analytics && (
            <div className="space-y-6">
              <h3 className="text-2xl font-bold">Comparative Analytics</h3>

              {/* Key Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="glass-card rounded-xl p-6 text-center">
                  <div className="text-sm text-white/40 mb-2">Average Rating</div>
                  <div className="text-3xl font-bold text-gold">
                    {comparisonData.analytics.average_rating}
                  </div>
                </div>
                <div className="glass-card rounded-xl p-6 text-center">
                  <div className="text-sm text-white/40 mb-2">Avg Runtime</div>
                  <div className="text-3xl font-bold text-gold">
                    {comparisonData.analytics.average_runtime}m
                  </div>
                </div>
                <div className="glass-card rounded-xl p-6 text-center">
                  <div className="text-sm text-white/40 mb-2">Year Range</div>
                  <div className="text-lg font-bold">
                    <span className="text-gold">{comparisonData.analytics.year_range.start}</span>
                    <span className="text-white/30 mx-2">-</span>
                    <span className="text-gold">{comparisonData.analytics.year_range.end}</span>
                  </div>
                </div>
                <div className="glass-card rounded-xl p-6 text-center">
                  <div className="text-sm text-white/40 mb-2">Highest Rated</div>
                  <div className="text-lg font-bold text-gold truncate">
                    {comparisonData.analytics.highest_rated_score}
                  </div>
                </div>
              </div>

              {/* Common Genres */}
              {comparisonData.analytics.common_genres?.length > 0 && (
                <div className="glass-card rounded-xl p-6">
                  <h4 className="font-semibold mb-4 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-gold" />
                    Common Genres
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {comparisonData.analytics.common_genres.map((genre: any) => (
                      <div
                        key={genre.id}
                        className="px-3 py-1.5 bg-gold/10 border border-gold/20 rounded-lg text-sm text-gold/80"
                      >
                        {genre.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pairwise Similarity */}
              {comparisonData.pairwise_similarity?.length > 0 && (
                <div className="glass-card rounded-xl p-6">
                  <h4 className="font-semibold mb-4 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-gold" />
                    Similarity Analysis
                  </h4>
                  <div className="space-y-3">
                    {comparisonData.pairwise_similarity.map(
                      (pair: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg"
                        >
                          <div className="flex-1">
                            <p className="text-sm font-medium text-white/80">
                              {pair.movie1} ↔ {pair.movie2}
                            </p>
                            <p className="text-xs text-white/40 mt-1">
                              {pair.recommendation}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-gold">
                              {pair.match_percentage}%
                            </div>
                            <div className="text-xs text-white/40">
                              {pair.similarity_score.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* No Results */}
          {!loading && !comparisonData && (
            <div className="text-center py-12">
              <TrendingUp className="w-12 h-12 text-white/20 mx-auto mb-4" />
              <p className="text-white/40">
                Select 2 or more movies and click "Compare" to see detailed analytics
              </p>
            </div>
          )}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="max-w-6xl mx-auto px-6 md:px-10">
          <div className="space-y-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 skeleton rounded-lg" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
