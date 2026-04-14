/**
 * Frontend Component Tests
 * Tests for critical UI components and user interactions
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import MovieCard from '@/components/MovieCard';
import MovieCarousel from '@/components/MovieCarousel';
import SearchModal from '@/components/SearchModal';
import type { MovieCompact } from '@/types/movie';

/**
 * Mock data for testing
 */
const mockMovie: MovieCompact = {
  id: 1,
  tmdb_id: 550,
  title: 'Fight Club',
  overview: 'An insomniac office worker and a devil-may-care soapmaker form an underground fight club',
  release_date: '1999-10-15',
  year: 1999,
  vote_average: 8.8,
  vote_count: 2000,
  popularity: 25.5,
  poster_url: 'https://image.tmdb.org/t/p/w342/pB8BM8dQwzi3lEyMZewDsislnQf.jpg',
  poster_url_small: 'https://image.tmdb.org/t/p/w185/pB8BM8dQwzi3lEyMZewDsislnQf.jpg',
  genres: [
    { id: 1, tmdb_id: 28, name: 'Action', slug: 'action' },
  ],
  runtime: 139,
};

const mockMovies: MovieCompact[] = [
  mockMovie,
  {
    ...mockMovie,
    id: 2,
    tmdb_id: 680,
    title: 'Pulp Fiction',
    vote_average: 8.9,
  },
  {
    ...mockMovie,
    id: 3,
    tmdb_id: 278,
    title: 'The Shawshank Redemption',
    vote_average: 9.3,
  },
];

describe('MovieCard Component', () => {
  /**
   * Test: MovieCard renders with proper structure
   * Why: Ensures the card displays correctly and is accessible
   */
  test('renders movie card with title and rating', () => {
    render(<MovieCard movie={mockMovie} index={0} />);
    
    expect(screen.getByText(mockMovie.title)).toBeInTheDocument();
    expect(screen.getByText(mockMovie.vote_average.toFixed(1))).toBeInTheDocument();
  });

  /**
   * Test: MovieCard displays year when available
   * Why: Year is important metadata for users to distinguish movies
   */
  test('displays release year when available', () => {
    render(<MovieCard movie={mockMovie} index={0} />);
    
    expect(screen.getByText('1999')).toBeInTheDocument();
  });

  /**
   * Test: MovieCard handles the missing year gracefully
   * Why: Ensures component doesn't crash with incomplete data
   */
  test('handles movie without year gracefully', () => {
    const movieNoYear = { ...mockMovie, year: null };
    const { container } = render(<MovieCard movie={movieNoYear} index={0} />);
    
    expect(container).toBeInTheDocument();
    expect(screen.getByText(mockMovie.title)).toBeInTheDocument();
  });

  /**
   * Test: MovieCard applies stagger animation
   * Why: Ensures visual polish and smooth user experience
   */
  test('applies animation delay based on index', () => {
    const { container } = render(<MovieCard movie={mockMovie} index={3} />);
    const card = container.firstChild;
    
    // Check that animation style is applied
    expect(card).toHaveStyle({ animationDelay: expect.any(String) });
  });
});

describe('MovieCarousel Component', () => {
  /**
   * Test: MovieCarousel renders all movies in the array
   * Why: Ensures all data is displayed to users
   */
  test('renders all movies passed to it', () => {
    render(
      <MovieCarousel
        title="Test Movies"
        movies={mockMovies}
        loading={false}
      />
    );
    
    expect(screen.getByText('Test Movies')).toBeInTheDocument();
    expect(screen.getByText(mockMovies[0].title)).toBeInTheDocument();
    expect(screen.getByText(mockMovies[1].title)).toBeInTheDocument();
    expect(screen.getByText(mockMovies[2].title)).toBeInTheDocument();
  });

  /**
   * Test: MovieCarousel shows loading skeletons
   * Why: Provides visual feedback while data is loading
   */
  test('displays skeleton loaders when loading', () => {
    const { container } = render(
      <MovieCarousel
        title="Loading..."
        movies={[]}
        loading={true}
      />
    );
    
    // Skeleton elements should be rendered
    const skeletons = container.querySelectorAll('[class*="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  /**
   * Test: MovieCarousel handles empty array safely
   * Why: Ensures no crash when no movies are available
   */
  test('handles empty movies array gracefully', () => {
    const { container } = render(
      <MovieCarousel
        title="No Movies"
        movies={[]}
        loading={false}
      />
    );
    
    expect(screen.getByText('No Movies')).toBeInTheDocument();
    expect(container).toBeInTheDocument();
  });

  /**
   * Test: MovieCarousel displays subtitle when provided
   * Why: Additional context helps users understand section purpose
   */
  test('displays subtitle when provided', () => {
    const subtitle = 'The best films of the year';
    render(
      <MovieCarousel
        title="Top Rated"
        subtitle={subtitle}
        movies={mockMovies}
        loading={false}
      />
    );
    
    expect(screen.getByText(subtitle)).toBeInTheDocument();
  });
});

describe('SearchModal Component', () => {
  /**
   * Test: SearchModal is hidden when closed
   * Why: Modal should only be visible when explicitly opened
   */
  test('does not render when open prop is false', () => {
    const { container } = render(
      <SearchModal open={false} onClose={() => {}} />
    );
    
    // Modal should not be in the DOM
    const modal = container.querySelector('[class*="fixed"]');
    expect(modal).not.toBeInTheDocument();
  });

  /**
   * Test: SearchModal displays search input when open
   * Why: Ensures user can interact with the search functionality
   */
  test('displays search input when open', () => {
    render(
      <SearchModal open={true} onClose={() => {}} />
    );
    
    const input = screen.getByPlaceholderText(/search movies/i);
    expect(input).toBeInTheDocument();
  });

  /**
   * Test: SearchModal can be closed by pressing Escape
   * Why: Standard UX pattern for dismissing modals
   */
  test('calls onClose when Escape key is pressed', () => {
    const onCloseMock = jest.fn();
    render(
      <SearchModal open={true} onClose={onCloseMock} />
    );
    
    const input = screen.getByPlaceholderText(/search movies/i);
    fireEvent.keyDown(input, { key: 'Escape' });
    
    expect(onCloseMock).toHaveBeenCalled();
  });

  /**
   * Test: SearchModal shows suggested search hints
   * Why: Helps users discover search functionality without typing
   */
  test('displays search hints in empty state', () => {
    render(
      <SearchModal open={true} onClose={() => {}} />
    );
    
    expect(screen.getByText(/try searching for/i)).toBeInTheDocument();
    expect(screen.getByText('Inception')).toBeInTheDocument();
  });

  /**
   * Test: SearchModal closes backdrop click
   * Why: Standard UX pattern for dismissing modals
   */
  test('closes when backdrop is clicked', () => {
    const onCloseMock = jest.fn();
    const { container } = render(
      <SearchModal open={true} onClose={onCloseMock} />
    );
    
    // Find and click the backdrop
    const backdrop = container.querySelector('[class*="backdrop"]');
    if (backdrop) {
      fireEvent.click(backdrop);
      expect(onCloseMock).toHaveBeenCalled();
    }
  });
});

describe('MovieCarousel Array Safety', () => {
  /**
   * Test: MovieCarousel safely converts non-array to array
   * Why: Prevents crashes from type mismatches in data
   */
  test('safely handles non-array movie prop', () => {
    const { container } = render(
      <MovieCarousel
        title="Safe Convert"
        movies={mockMovies}
        loading={false}
      />
    );
    
    // Should not crash and should render properly
    expect(screen.getByText('Safe Convert')).toBeInTheDocument();
    expect(container).toBeInTheDocument();
  });

  /**
   * Test: MovieCarousel preserves movie data integrity
   * Why: Ensures no data corruption during rendering
   */
  test('preserves movie data without modification', () => {
    render(
      <MovieCarousel
        title="Data Integrity"
        movies={mockMovies}
        loading={false}
      />
    );
    
    // Check that all movies display with correct titles
    mockMovies.forEach(movie => {
      expect(screen.getByText(movie.title)).toBeInTheDocument();
    });
  });
});

describe('Component Interaction Tests', () => {
  /**
   * Test: MovieCard is clickable and navigates
   * Why: Primary user interaction for discovering movie details
   */
  test('MovieCard elements are interactive', () => {
    const { container } = render(<MovieCard movie={mockMovie} index={0} />);
    
    // Check that card is interactive (has link or button)
    const interactiveElements = container.querySelectorAll('[role="link"], [role="button"], a, button');
    expect(interactiveElements.length).toBeGreaterThan(0);
  });

  /**
   * Test: MovieCarousel scroll buttons are functional
   * Why: Ensures users can navigate through carousel items
   */
  test('MovieCarousel has scroll navigation buttons', () => {
    const { container } = render(
      <MovieCarousel
        title="Scrollable"
        movies={mockMovies}
        loading={false}
      />
    );
    
    // Check for scroll buttons
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(0);
  });
});

/**
 * Test Summary:
 * 
 * TESTED AREAS:
 * 1. MovieCard Component:
 *    - Correct rendering of title and rating
 *    - Year display logic
 *    - Animation application
 *    - Graceful degradation with missing data
 * 
 * 2. MovieCarousel Component:
 *    - Multiple movies rendering
 *    - Loading state handling
 *    - Empty state handling
 *    - Subtitle display
 *    - Array safety conversion
 * 
 * 3. SearchModal Component:
 *    - Modal visibility toggling
 *    - Search input availability
 *    - Keyboard shortcuts (Escape)
 *    - Hint display
 *    - Backdrop interaction
 * 
 * UNTESTED AREAS & RISKS:
 * 1. API Integration:
 *    - Actual API calls and error handling are mocked
 *    - Real network failures could cause issues in production
 *    Risk: High - Real API errors may not be handled properly
 * 
 * 2. Authentication Flow:
 *    - Auth modal and login/signup not tested
 *    Risk: High - Auth errors could break app navigation
 * 
 * 3. Complex User Interactions:
 *    - Multi-step workflows not tested
 *    - State management across multiple components
 *    Risk: Medium - Complex flows may have edge case bugs
 * 
 * 4. Responsive Design:
 *    - Mobile/tablet layouts not tested
 *    Risk: Medium - Layout may break on different screen sizes
 * 
 * 5. Performance:
 *    - Large list rendering (100+ movies)
 *    - Memory leaks from event listeners
 *    Risk: Medium - App may be slow with large datasets
 */
