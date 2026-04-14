## Overview
This guide provides step-by-step instructions for setting up the CineQuest application, including backend (Django) and frontend (Next.js) environments.

## System Requirements
- Python 3.10+
- Node.js 18+ and npm or yarn
- Git
- SQLite3 (usually included)

## Backend Setup (Django)

### 1. Create Python Virtual Environment
```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate
```

### 2. Install Python Dependencies
```bash
pip install -r requirements.txt
```

### 3. Configure Environment Variables
Create a `.env` file in the `backend` directory:

```env
# Django settings
DEBUG=True
SECRET_KEY=your-secret-key-change-this-in-production
ALLOWED_HOSTS=localhost,127.0.0.1

# TMDB API Configuration (REQUIRED)
TMDB_API_KEY=your_tmdb_api_key_here

# CORS settings
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# Database
DATABASE_URL=sqlite:///db.sqlite3
```

**How to get TMDB API Key:**
1. Visit https://www.themoviedb.org/settings/api
2. Create an account if needed
3. Request an API key
4. Copy your API key to the `.env` file

### 4. Apply Database Migrations
```bash
python manage.py migrate
```

### 5. Create Superuser (Optional, for admin access)
```bash
python manage.py createsuperuser
```

### 6. Load Initial Data (Optional)
```bash
# Create genres from TMDB
python manage.py sync_movies
```

### 7. Run Development Server
```bash
python manage.py runserver
```

Backend will be available at: `http://localhost:8000/api/`

---

## Frontend Setup (Next.js)

### 1. Install Node Dependencies
```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install
# or
yarn install
```

### 2. Configure Environment Variables
Create a `.env.local` file in the `frontend` directory:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

### 3. Run Development Server
```bash
npm run dev
# or
yarn dev
```

Frontend will be available at: `http://localhost:3000`

### 4. Build for Production (Optional)
```bash
npm run build
npm start
```

---

## Troubleshooting

### Backend Issues

**Problem: Migration errors**
```bash
# Solution: Reset database and migrate
python manage.py migrate
movies zero  # Reset movies app migrations
python manage.py migrate
```

**Problem: TMDB API Key not working**
- Verify the key in your `.env` file
- Ensure the `.env` file is loaded correctly
- Check TMDB API rate limits (100 requests per 10 seconds)

**Problem: CORS errors**
- Verify `CORS_ORIGINS` includes your frontend URL
- Restart Django server after changing `.env`

### Frontend Issues

**Problem: API calls failing**
```
Solution: Verify NEXT_PUBLIC_API_URL in .env.local
$ cat .env.local  # Check the value
```

**Problem: Port already in use**
```bash
# Change port for dev server
npm run dev -- -p 3001
```

---

## Running Tests

### Backend Tests
```bash
cd backend

# Run all tests
python manage.py test

# Run specific test file
python manage.py test movies.tests

# Run with verbosity
python manage.py test --verbosity=2
```

### Frontend Tests
```bash
cd frontend

# Run tests
npm test

# Run with coverage
npm test -- --coverage
```

---

## Project Structure

```
CineQuest/
├── backend/                    # Django REST API
│   ├── cinequest/             # Django project settings
│   ├── movies/                # Movies app
│   ├── recommendations/       # Recommendations engine
│   ├── users/                 # User authentication
│   ├── manage.py
│   └── requirements.txt
│
├── frontend/                   # Next.js application
│   ├── src/
│   │   ├── app/               # Pages and layouts
│   │   ├── components/        # React components
│   │   ├── lib/               # Utilities and API client
│   │   └── types/             # TypeScript definitions
│   ├── package.json
│   └── next.config.js
│
└── README.md
```

---

## Key Endpoints

### Movies API
- `GET /api/movies/search/?q=query` - Search movies
- `GET /api/movies/trending/` - Trending movies
- `GET /api/movies/now-playing/` - Now playing
- `GET /api/movies/top-rated/` - Top rated movies
- `GET /api/movies/genres/` - List all genres
- `GET /api/movies/moods/` - List mood-based categories

### Authentication
- `POST /api/auth/token/` - Login
- `POST /api/auth/token/refresh/` - Refresh token

### Recommendations
- `GET /api/recommendations/for-you/` - Personalized recommendations
- `GET /api/recommendations/watchlist/` - User's watchlist
- `POST /api/recommendations/track/` - Track user interaction

---

## Development Workflow

### Creating Database Migrations
```bash
# After modifying models.py
cd backend
python manage.py makemigrations
python manage.py migrate
```

### Adding New Dependencies
```bash
# Backend
cd backend
pip install package-name
pip freeze > requirements.txt

# Frontend
cd frontend
npm install package-name
```

### Code Formatting
```bash
# Backend (install black first)
pip install black
black .

# Frontend (prettier already configured)
npm run format
```

---

## Deployment Preparation

### Backend Deployment
1. Set `DEBUG=False` in production
2. Generate new `SECRET_KEY`
3. Add production domain to `ALLOWED_HOSTS`
4. Configure production database (PostgreSQL recommended)
5. Set up static files collection: `python manage.py collectstatic`
6. Use WSGI server (Gunicorn, uWSGI)

### Frontend Deployment
1. Build production bundle: `npm run build`
2. Deploy to Vercel, Netlify, or your hosting provider
3. Update `NEXT_PUBLIC_API_URL` for production API endpoint

---

## Support & Additional Resources

- Django Documentation: https://docs.djangoproject.com/
- Next.js Documentation: https://nextjs.org/docs
- The Movie Database  API: https://developer.themoviedb.org/docs
- DRF Documentation: https://www.django-rest-framework.org/

---

## License
This project is part of the Uganda Christian University examination.
