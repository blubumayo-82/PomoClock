"""
PomoHaven - Cozy & Deep Study Flow Pomodoro Backend Application
Flask application providing SQLite persistence, optional user authentication,
Guest Mode fallback, productivity statistics calculation, and user preferences management.
"""

import os
import re
import sqlite3
from datetime import datetime, timedelta, timezone
from flask import Flask, render_template, request, jsonify, g, session, Response
from werkzeug.security import generate_password_hash, check_password_hash
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    def load_dotenv(): pass

try:
    from google.oauth2 import id_token
    from google.auth.transport import requests as google_requests
except ImportError:
    id_token = None
    google_requests = None

from flask_sqlalchemy import SQLAlchemy

# Initialize Flask application
app = Flask(__name__, static_folder='static', template_folder='templates')
app.secret_key = os.environ.get('SECRET_KEY', 'default-dev-fallback-key-pomohaven-2026')

app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=30)
is_production_env = (
    os.environ.get('DYNO') is not None
    or os.environ.get('FLASK_ENV') == 'production'
    or os.environ.get('ENVIRONMENT') == 'production'
    or os.environ.get('SESSION_COOKIE_SECURE', '').lower() in ('true', '1')
)
app.config['SESSION_COOKIE_SECURE'] = True if is_production_env else (os.environ.get('SESSION_COOKIE_SECURE', '').lower() in ('true', '1'))
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'

# Initialize Rate Limiter
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=[],
    storage_uri=os.environ.get("RATELIMIT_STORAGE_URI", "memory://")
)


@app.errorhandler(429)
def ratelimit_handler(e):
    """Custom JSON response for rate limit violations."""
    return jsonify({
        "success": False,
        "error": "Rate limit exceeded. Please try again later.",
        "message": "Too many requests. Please slow down."
    }), 429


GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID', '')
GOOGLE_CLIENT_SECRET = os.getenv('GOOGLE_CLIENT_SECRET', '')

# Database path & URI configuration with Heroku postgres:// -> postgresql:// fix
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DATABASE = os.path.join(BASE_DIR, 'pomodoro.db')

db_url = os.environ.get('DATABASE_URL', f'sqlite:///{DATABASE}')
if db_url and db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)
app.config['SQLALCHEMY_DATABASE_URI'] = db_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)


# ----------------------------------------------------------------------
# SQLAlchemy Models for PostgreSQL / SQLite Persistence
# ----------------------------------------------------------------------

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), nullable=True)
    name = db.Column(db.String(120), nullable=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=True)
    avatar_url = db.Column(db.String(255), nullable=True)
    auth_provider = db.Column(db.String(50), default='local')
    google_id = db.Column(db.String(100), unique=True, nullable=True)
    created_at = db.Column(db.String(50), default=lambda: datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S'))

    sessions = db.relationship('StudySession', backref='user', lazy=True, cascade='all, delete-orphan')
    streaks = db.relationship('DailyStreak', backref='user', lazy=True, cascade='all, delete-orphan')


class StudySession(db.Model):
    __tablename__ = 'sessions'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=True)
    mode = db.Column(db.String(50), nullable=False)
    duration_minutes = db.Column(db.Float, nullable=False)
    start_time = db.Column(db.String(100), nullable=False)
    end_time = db.Column(db.String(100), nullable=True)
    status = db.Column(db.String(50), nullable=False, default='completed')
    task_name = db.Column(db.String(200), default='Study Session')
    created_at = db.Column(db.String(50), default=lambda: datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S'))


# Model alias for StudySession / Session
Session = StudySession


class DailyStreak(db.Model):
    __tablename__ = 'daily_streaks'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=True)
    date = db.Column(db.String(20), nullable=False)
    pomodoro_count = db.Column(db.Integer, default=0)
    total_minutes = db.Column(db.Float, default=0.0)
    created_at = db.Column(db.String(50), default=lambda: datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S'))


class Preference(db.Model):
    __tablename__ = 'preferences'
    key = db.Column(db.String(100), primary_key=True)
    value = db.Column(db.Text, nullable=False)
    updated_at = db.Column(db.String(50), default=lambda: datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S'))


class UserPreference(db.Model):
    __tablename__ = 'user_preferences'
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True)
    key = db.Column(db.String(100), primary_key=True)
    value = db.Column(db.Text, nullable=False)
    updated_at = db.Column(db.String(50), default=lambda: datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S'))


class Feedback(db.Model):
    __tablename__ = 'feedbacks'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    user_email = db.Column(db.String(255), nullable=True)
    feedback_type = db.Column(db.String(100), default='Feature Request')
    message = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))


def get_db():
    """
    Get or create a database connection for the current application context.
    Configures row factory to return dict-like sqlite3.Row objects.
    """
    if 'db' not in g:
        g.db = sqlite3.connect(DATABASE)
        g.db.row_factory = sqlite3.Row
        # Enable WAL mode for high concurrency and write speed
        try:
            g.db.execute("PRAGMA journal_mode=WAL;")
        except Exception:
            pass
    return g.db


@app.teardown_appcontext
def close_db(exception):
    """Closes the database connection at the end of the request context."""
    db_conn = g.pop('db', None)
    if db_conn is not None:
        db_conn.close()


def init_db():
    """
    Initializes database tables if they do not exist.
    Creates tables via SQLAlchemy models and handles schema migrations.
    """
    with app.app_context():
        db.create_all()

    # SQLite fallback verification if using SQLite file
    try:
        db_conn = sqlite3.connect(DATABASE)
        cursor = db_conn.cursor()

        # Create users table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT,
                name TEXT,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT,
                avatar_url TEXT,
                auth_provider TEXT DEFAULT 'local',
                google_id TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # Schema migration check for users table
        cursor.execute("PRAGMA table_info(users);")
        existing_user_cols = [row[1] for row in cursor.fetchall()]
        if 'name' not in existing_user_cols:
            cursor.execute("ALTER TABLE users ADD COLUMN name TEXT;")
        if 'avatar_url' not in existing_user_cols:
            cursor.execute("ALTER TABLE users ADD COLUMN avatar_url TEXT;")
        if 'auth_provider' not in existing_user_cols:
            cursor.execute("ALTER TABLE users ADD COLUMN auth_provider TEXT DEFAULT 'local';")
        if 'google_id' not in existing_user_cols:
            cursor.execute("ALTER TABLE users ADD COLUMN google_id TEXT;")

        # Create sessions table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                mode TEXT NOT NULL,
                duration_minutes REAL NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT,
                status TEXT NOT NULL DEFAULT 'completed',
                task_name TEXT DEFAULT 'Study Session',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
        """)

        # Ensure user_id column exists if table was created in an earlier schema
        cursor.execute("PRAGMA table_info(sessions);")
        columns = [row[1] for row in cursor.fetchall()]
        if 'user_id' not in columns:
            cursor.execute("ALTER TABLE sessions ADD COLUMN user_id INTEGER;")

        # Create daily_streaks table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS daily_streaks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                date TEXT NOT NULL,
                pomodoro_count INTEGER DEFAULT 0,
                total_minutes REAL DEFAULT 0.0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
        """)

        # Indices for high-performance aggregations
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_sessions_query 
            ON sessions(mode, status, start_time);
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_sessions_user 
            ON sessions(user_id);
        """)

        # Create global preferences table (for guest mode)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS preferences (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # Create user-specific preferences table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_preferences (
                user_id INTEGER NOT NULL,
                key TEXT NOT NULL,
                value TEXT NOT NULL,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, key),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
        """)

        # Create feedbacks table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS feedbacks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                user_email TEXT,
                feedback_type TEXT DEFAULT 'Feature Request',
                message TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
            );
        """)

        db_conn.commit()
        db_conn.close()
    except Exception:
        pass


# Ensure PostgreSQL / SQLite tables are automatically generated on startup
with app.app_context():
    db.create_all()

# Ensure DB schema is ready at startup
init_db()


def get_current_user_id():
    """Returns the authenticated user's ID from Flask session, or None for Guest."""
    return session.get('user_id')


@app.after_request
def add_security_headers(response):
    """
    Configures response headers for Cross-Origin-Opener-Policy (COOP) and COEP.
    Enables Google Identity Services OAuth popup and postMessage communication.
    """
    response.headers['Cross-Origin-Opener-Policy'] = 'same-origin-allow-popups'
    response.headers['Cross-Origin-Embedder-Policy'] = 'unsafe-none'
    return response


# ----------------------------------------------------------------------
# Page Routes & Config
# ----------------------------------------------------------------------

@app.route('/')
def index():
    """Renders the main Pomodoro Study Timer single-page application."""
    google_id = os.environ.get('GOOGLE_CLIENT_ID', GOOGLE_CLIENT_ID)
    return render_template('index.html', google_client_id=google_id)


@app.route('/robots.txt')
def robots_txt():
    """Serves robots.txt search engine crawling directives dynamically."""
    lines = [
        "User-agent: *",
        "Allow: /",
        "Sitemap: https://pomohaven.com/sitemap.xml"
    ]
    return Response("\n".join(lines), mimetype="text/plain")


@app.route('/sitemap.xml')
def sitemap_xml():
    """Serves XML sitemap for search engine indexing."""
    sitemap = """<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://pomohaven.com/</loc>
    <lastmod>2026-08-27</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>"""
    return Response(sitemap, mimetype="application/xml")


@app.route('/api/config', methods=['GET'])
def get_config():
    """Returns public client configuration for frontend initialization."""
    google_id = os.environ.get('GOOGLE_CLIENT_ID', GOOGLE_CLIENT_ID)
    return jsonify({
        "google_client_id": google_id
    }), 200


# ----------------------------------------------------------------------
# Authentication Endpoints (Email/Password & Google OAuth 2.0)
# ----------------------------------------------------------------------

@app.route('/api/auth/google', methods=['POST'])
@limiter.limit("30 per minute; 120 per hour")
def google_auth():
    """
    Authenticates a user via Google OAuth 2.0 Identity Services.
    Expects JSON: { email, name, google_id, avatar_url, credential }
    Checks if user exists, creates or updates the user, and stores session['user_id'].
    """
    data = request.get_json() or {}
    token = data.get('credential') or data.get('token') or data.get('id_token')
    email = data.get('email')
    name = data.get('name')
    google_id = data.get('google_id')
    avatar_url = data.get('avatar_url')

    # If credential token is passed, verify and extract profile info if not directly provided
    if token and id_token and (not email or not google_id):
        try:
            req = google_requests.Request()
            if GOOGLE_CLIENT_ID:
                idinfo = id_token.verify_oauth2_token(token, req, GOOGLE_CLIENT_ID)
            else:
                idinfo = id_token.verify_oauth2_token(token, req)

            google_id = google_id or idinfo.get('sub')
            email = email or idinfo.get('email')
            name = name or idinfo.get('name') or idinfo.get('given_name') or (email.split('@')[0] if email else '')
            avatar_url = avatar_url or idinfo.get('picture')
        except Exception:
            pass

    if email:
        email = email.strip().lower()

    if not email:
        return jsonify({'error': 'Email is required', 'success': False}), 400

    if not name:
        name = email.split('@')[0]

    try:
        user = None
        if google_id:
            user = User.query.filter_by(google_id=google_id).first()
        if not user and email:
            user = User.query.filter_by(email=email).first()

        if not user:
            user = User(
                google_id=google_id,
                email=email,
                name=name,
                username=name,
                avatar_url=avatar_url or '',
                password_hash='',
                auth_provider='google'
            )
            db.session.add(user)
            db.session.commit()
        else:
            if google_id:
                user.google_id = google_id
            if name:
                user.name = name
            if avatar_url:
                user.avatar_url = avatar_url
            db.session.commit()
        session.permanent = True
        session['user_id'] = user.id

        # Synchronize SQLite users table if running direct queries
        try:
            db_conn = get_db()
            cursor = db_conn.cursor()
            cursor.execute("SELECT id FROM users WHERE (google_id IS NOT NULL AND google_id = ?) OR LOWER(email) = ?", (google_id or '', email))
            sqlite_user = cursor.fetchone()
            if not sqlite_user:
                cursor.execute("""
                    INSERT INTO users (id, username, name, email, avatar_url, auth_provider, google_id)
                    VALUES (?, ?, ?, ?, ?, 'google', ?)
                """, (user.id, user.username or name, user.name or name, email, avatar_url or '', google_id))
                db_conn.commit()
            else:
                cursor.execute("""
                    UPDATE users SET google_id = COALESCE(?, google_id), name = COALESCE(?, name), avatar_url = COALESCE(?, avatar_url)
                    WHERE id = ?
                """, (google_id, name, avatar_url, sqlite_user['id']))
                db_conn.commit()
        except Exception:
            pass

        display_name = user.name or user.username or user.email.split('@')[0]
        total_minutes = getattr(user, 'total_focus_minutes', 0) or 0
        completed_sessions = getattr(user, 'completed_sessions', 0) or 0

        user_payload = {
            'id': user.id,
            'email': user.email,
            'name': display_name,
            'username': display_name,
            'avatar_url': user.avatar_url or '',
            'auth_provider': user.auth_provider or 'google',
            'created_at': str(user.created_at) if hasattr(user, 'created_at') else '',
            'total_minutes': total_minutes,
            'completed_sessions': completed_sessions
        }

        return jsonify({
            'success': True,
            'id': user.id,
            'email': user.email,
            'name': display_name,
            'user': user_payload,
            'total_minutes': total_minutes,
            'completed_sessions': completed_sessions
        }), 200

    except Exception as err:
        return jsonify({'error': f'Database error: {str(err)}', 'success': False}), 500


@app.route('/api/auth/register', methods=['POST'])
@limiter.limit("20 per minute; 100 per hour")
def register():
    """
    Registers a new user with username/name, email, password, and confirm_password.
    """
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "error": "Invalid or missing JSON payload"}), 400

    username = (data.get('username') or data.get('name') or '').strip()
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''
    confirm_password = data.get('confirm_password')

    # If confirm_password is provided in registration payload, verify match
    if confirm_password is not None and password != confirm_password:
        return jsonify({"success": False, "error": "Passwords do not match."}), 400

    if not email or '@' not in email:
        return jsonify({"success": False, "error": "A valid email address is required"}), 400

    if not username:
        username = email.split('@')[0]

    if len(username) < 2 or len(username) > 50:
        return jsonify({"success": False, "error": "Name/Username must be between 2 and 50 characters"}), 400

    if not password or len(password) < 6:
        return jsonify({"success": False, "error": "Password must be at least 6 characters long"}), 400

    # Check if email is already taken
    existing_user = User.query.filter_by(email=email).first()
    if not existing_user:
        try:
            sqlite_conn = get_db()
            cursor = sqlite_conn.cursor()
            cursor.execute("SELECT id FROM users WHERE LOWER(email) = ?", (email,))
            if cursor.fetchone():
                existing_user = True
        except Exception:
            pass

    if existing_user:
        return jsonify({"success": False, "error": "An account with this email already exists"}), 409

    # Hash password with scrypt/pbkdf2
    pwd_hash = generate_password_hash(password)

    try:
        user = User(
            username=username,
            name=username,
            email=email,
            password_hash=pwd_hash,
            auth_provider='local'
        )
        db.session.add(user)
        db.session.commit()

        user_id = user.id
        session.permanent = True
        session['user_id'] = user_id

        # Direct SQLite synchronization
        try:
            sqlite_conn = get_db()
            cursor = sqlite_conn.cursor()
            cursor.execute("""
                INSERT INTO users (id, username, name, email, password_hash, auth_provider)
                VALUES (?, ?, ?, ?, ?, 'local')
            """, (user.id, username, username, email, pwd_hash))
            sqlite_conn.commit()
        except Exception:
            pass

        return jsonify({
            "success": True,
            "message": "Account created successfully",
            "user": {
                "id": user_id,
                "username": username,
                "name": username,
                "email": email,
                "avatar_url": '',
                "auth_provider": 'local',
                "created_at": str(user.created_at) if hasattr(user, 'created_at') else datetime.now(timezone.utc).isoformat()
            }
        }), 201

    except Exception as err:
        db.session.rollback()
        return jsonify({"success": False, "error": f"Failed to create account: {str(err)}"}), 500


@app.route('/api/auth/login', methods=['POST'])
@limiter.limit("20 per minute; 100 per hour")
def login():
    """
    Logs in an existing user with email/username and password.
    """
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "error": "Invalid or missing JSON payload"}), 400

    login_identifier = (data.get('email') or data.get('username') or data.get('login') or '').strip().lower()
    password = data.get('password') or ''

    if not login_identifier or not password:
        return jsonify({"success": False, "error": "Email/Username and password are required"}), 400

    # Query user via SQLAlchemy first
    user = User.query.filter(
        (db.func.lower(User.email) == login_identifier) |
        (db.func.lower(User.username) == login_identifier) |
        (db.func.lower(User.name) == login_identifier)
    ).first()

    if user:
        if not user.password_hash:
            if user.auth_provider == 'google':
                return jsonify({"success": False, "error": "This account was created with Google Sign-In. Please sign in with Google."}), 400
            return jsonify({"success": False, "error": "Account has no password set"}), 401

        if not check_password_hash(user.password_hash, password):
            return jsonify({"success": False, "error": "Invalid email/username or password"}), 401

        session.permanent = True
        session['user_id'] = user.id
        display_name = user.name or user.username or user.email.split('@')[0]

        return jsonify({
            "success": True,
            "message": "Login successful",
            "user": {
                "id": user.id,
                "username": display_name,
                "name": display_name,
                "email": user.email,
                "avatar_url": user.avatar_url or '',
                "auth_provider": user.auth_provider or 'local',
                "created_at": str(user.created_at) if hasattr(user, 'created_at') else ''
            }
        }), 200

    # SQLite fallback check
    sqlite_conn = get_db()
    cursor = sqlite_conn.cursor()
    cursor.execute("""
        SELECT id, username, name, email, password_hash, avatar_url, auth_provider, created_at 
        FROM users 
        WHERE LOWER(email) = ? OR LOWER(username) = ? OR LOWER(name) = ?
    """, (login_identifier, login_identifier, login_identifier))
    sqlite_user = cursor.fetchone()

    if not sqlite_user:
        return jsonify({"success": False, "error": "Invalid email/username or password"}), 401

    if not sqlite_user['password_hash']:
        if sqlite_user['auth_provider'] == 'google':
            return jsonify({"success": False, "error": "This account was created with Google Sign-In. Please sign in with Google."}), 400
        return jsonify({"success": False, "error": "Account has no password set"}), 401

    if not check_password_hash(sqlite_user['password_hash'], password):
        return jsonify({"success": False, "error": "Invalid email/username or password"}), 401

    session.permanent = True
    session['user_id'] = sqlite_user['id']
    display_name = sqlite_user['name'] or sqlite_user['username'] or sqlite_user['email'].split('@')[0]

    return jsonify({
        "success": True,
        "message": "Login successful",
        "user": {
            "id": sqlite_user['id'],
            "username": display_name,
            "name": display_name,
            "email": sqlite_user['email'],
            "avatar_url": sqlite_user['avatar_url'] or '',
            "auth_provider": sqlite_user['auth_provider'] or 'local',
            "created_at": sqlite_user['created_at']
        }
    }), 200


@app.route('/api/auth/logout', methods=['POST'])
def logout():
    """Logs out current user session."""
    session.clear()
    return jsonify({"success": True, "message": "Logged out successfully"}), 200


@app.route('/api/auth/me', methods=['GET'])
@app.route('/api/user/me', methods=['GET'])
@app.route('/api/user/profile', methods=['GET'])
def get_current_user():
    """Returns authentication status and current user profile strictly from session."""
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"authenticated": False, "user": None}), 200

    user = db.session.get(User, user_id)
    if not user:
        # SQLite fallback check if using direct SQLite
        sqlite_conn = get_db()
        cursor = sqlite_conn.cursor()
        cursor.execute("""
            SELECT id, username, name, email, avatar_url, auth_provider, created_at 
            FROM users 
            WHERE id = ?
        """, (user_id,))
        sqlite_user = cursor.fetchone()
        if not sqlite_user:
            session.pop('user_id', None)
            return jsonify({"authenticated": False, "user": None}), 200

        display_name = sqlite_user['name'] or sqlite_user['username'] or sqlite_user['email'].split('@')[0]
        return jsonify({
            "authenticated": True,
            "user": {
                "id": sqlite_user['id'],
                "username": display_name,
                "name": display_name,
                "email": sqlite_user['email'],
                "avatar_url": sqlite_user['avatar_url'] or '',
                "auth_provider": sqlite_user['auth_provider'] or 'local',
                "created_at": sqlite_user['created_at']
            }
        }), 200

    display_name = user.name or user.username or user.email.split('@')[0]

    return jsonify({
        "authenticated": True,
        "user": {
            "id": user.id,
            "username": display_name,
            "name": display_name,
            "email": user.email,
            "avatar_url": user.avatar_url or '',
            "auth_provider": user.auth_provider or 'local',
            "created_at": str(user.created_at) if hasattr(user, 'created_at') else ''
        }
    }), 200


# ----------------------------------------------------------------------
# REST API Endpoints: Sessions & Sync
# ----------------------------------------------------------------------

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint to verify backend service status."""
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "guest_mode": True
    }), 200


def update_daily_streak_record(cursor, user_id, date_str, duration_minutes):
    """
    Updates or inserts a daily streak row in the SQLite daily_streaks table
    for the specified user (or guest) and date.
    """
    try:
        if user_id:
            cursor.execute("""
                SELECT id, pomodoro_count, total_minutes 
                FROM daily_streaks 
                WHERE user_id = ? AND date = ?
            """, (user_id, date_str))
        else:
            cursor.execute("""
                SELECT id, pomodoro_count, total_minutes 
                FROM daily_streaks 
                WHERE user_id IS NULL AND date = ?
            """, (date_str,))
        
        row = cursor.fetchone()
        if row:
            streak_id = row['id']
            cursor.execute("""
                UPDATE daily_streaks 
                SET pomodoro_count = pomodoro_count + 1,
                    total_minutes = total_minutes + ?
                WHERE id = ?
            """, (duration_minutes, streak_id))
        else:
            cursor.execute("""
                INSERT INTO daily_streaks (user_id, date, pomodoro_count, total_minutes)
                VALUES (?, ?, 1, ?)
            """, (user_id, date_str, duration_minutes))
    except Exception as err:
        app.logger.warning(f"Error updating SQLite daily_streaks: {err}")


@app.route('/api/sessions', methods=['POST'])
@app.route('/api/log-session', methods=['POST'])
def record_session():
    """
    Records a completed, skipped, or interrupted timer session.
    Automatically attaches user_id if authenticated, or logs as guest.
    Persists to PostgreSQL (via SQLAlchemy) and SQLite, updating daily_streaks.
    """
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "error": "Invalid or missing JSON payload"}), 400

    raw_mode = (data.get('mode') or 'pomodoro').lower().replace('-', '_')
    allowed_modes = ['pomodoro', 'work', 'focus', 'short_break', 'shortbreak', 'long_break', 'longbreak']
    if raw_mode not in allowed_modes:
        return jsonify({"success": False, "error": f"Invalid mode. Allowed: {allowed_modes}"}), 400

    mode = raw_mode
    if mode in ['work', 'focus']:
        mode = 'work'
    elif mode == 'shortbreak':
        mode = 'short_break'
    elif mode == 'longbreak':
        mode = 'long_break'

    try:
        duration_minutes = float(data.get('duration_minutes', 25.0))
        if duration_minutes < 0:
            raise ValueError("Duration cannot be negative.")
    except (ValueError, TypeError):
        return jsonify({"success": False, "error": "Invalid duration_minutes value"}), 400

    start_time = data.get('start_time') or datetime.now(timezone.utc).isoformat()
    end_time = data.get('end_time') or datetime.now(timezone.utc).isoformat()

    status = data.get('status', 'completed')
    allowed_statuses = ['completed', 'skipped', 'interrupted']
    if status not in allowed_statuses:
        status = 'completed'

    task_name = (data.get('task_name') or 'Study Session').strip()[:100]
    user_id = session.get('user_id') or get_current_user_id() or data.get('user_id')

    session_id = None
    date_str = start_time[:10] if start_time and len(start_time) >= 10 else datetime.now().strftime('%Y-%m-%d')

    # 1. Persist to PostgreSQL / SQLAlchemy
    try:
        sess_obj = StudySession(
            user_id=user_id,
            mode=mode,
            duration_minutes=duration_minutes,
            start_time=start_time,
            end_time=end_time,
            status=status,
            task_name=task_name
        )
        db.session.add(sess_obj)

        if mode in ['pomodoro', 'work', 'focus'] and status == 'completed':
            streak = DailyStreak.query.filter_by(user_id=user_id, date=date_str).first()
            if streak:
                streak.pomodoro_count = (streak.pomodoro_count or 0) + 1
                streak.total_minutes = (streak.total_minutes or 0.0) + duration_minutes
            else:
                streak = DailyStreak(
                    user_id=user_id,
                    date=date_str,
                    pomodoro_count=1,
                    total_minutes=duration_minutes
                )
                db.session.add(streak)

        db.session.commit()
        session_id = sess_obj.id
    except Exception as sa_err:
        db.session.rollback()
        app.logger.warning(f"SQLAlchemy persistence note: {sa_err}")

    # 2. Persist to SQLite
    try:
        sqlite_conn = get_db()
        cursor = sqlite_conn.cursor()
        cursor.execute("""
            INSERT INTO sessions (user_id, mode, duration_minutes, start_time, end_time, status, task_name)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (user_id, mode, duration_minutes, start_time, end_time, status, task_name))
        
        if not session_id:
            session_id = cursor.lastrowid

        if mode in ['pomodoro', 'work', 'focus'] and status == 'completed':
            update_daily_streak_record(cursor, user_id, date_str, duration_minutes)

        sqlite_conn.commit()
    except Exception as sqlite_err:
        app.logger.warning(f"SQLite insertion note: {sqlite_err}")

    return jsonify({
        "success": True,
        "message": "Session recorded successfully",
        "session": {
            "id": session_id,
            "user_id": user_id,
            "mode": mode,
            "duration_minutes": duration_minutes,
            "start_time": start_time,
            "end_time": end_time,
            "status": status,
            "task_name": task_name
        }
    }), 201


@app.route('/api/sessions/batch', methods=['POST'])
def batch_sync_sessions():
    """
    Batch uploads/syncs an array of guest sessions from localStorage
    into the database under the current authenticated user's account.
    """
    data = request.get_json()
    if not data or not isinstance(data.get('sessions'), list):
        return jsonify({"success": False, "error": "Expected a JSON object with a 'sessions' array"}), 400

    sessions_to_sync = data.get('sessions')
    user_id = session.get('user_id') or get_current_user_id()
    synced_count = 0

    try:
        for item in sessions_to_sync:
            mode = item.get('mode', 'pomodoro')
            if mode in ['work', 'focus']:
                mode = 'work'
            duration = float(item.get('duration_minutes', 25.0))
            start_time = item.get('start_time') or datetime.now(timezone.utc).isoformat()
            end_time = item.get('end_time') or start_time
            status = item.get('status', 'completed')
            task_name = (item.get('task_name') or 'Study Session').strip()[:100]
            date_str = start_time[:10] if start_time and len(start_time) >= 10 else datetime.now().strftime('%Y-%m-%d')

            # SQLAlchemy check
            existing = StudySession.query.filter_by(user_id=user_id, start_time=start_time, mode=mode).first()
            if not existing:
                sess_obj = StudySession(
                    user_id=user_id,
                    mode=mode,
                    duration_minutes=duration,
                    start_time=start_time,
                    end_time=end_time,
                    status=status,
                    task_name=task_name
                )
                db.session.add(sess_obj)

                if mode in ['pomodoro', 'work', 'focus'] and status == 'completed':
                    streak = DailyStreak.query.filter_by(user_id=user_id, date=date_str).first()
                    if streak:
                        streak.pomodoro_count = (streak.pomodoro_count or 0) + 1
                        streak.total_minutes = (streak.total_minutes or 0.0) + duration
                    else:
                        streak = DailyStreak(user_id=user_id, date=date_str, pomodoro_count=1, total_minutes=duration)
                        db.session.add(streak)
                synced_count += 1

        db.session.commit()

        # SQLite sync
        try:
            sqlite_conn = get_db()
            cursor = sqlite_conn.cursor()
            for item in sessions_to_sync:
                mode = item.get('mode', 'pomodoro')
                if mode in ['work', 'focus']:
                    mode = 'work'
                duration = float(item.get('duration_minutes', 25.0))
                start_time = item.get('start_time') or datetime.now(timezone.utc).isoformat()
                end_time = item.get('end_time') or start_time
                status = item.get('status', 'completed')
                task_name = (item.get('task_name') or 'Study Session').strip()[:100]
                date_str = start_time[:10] if start_time and len(start_time) >= 10 else datetime.now().strftime('%Y-%m-%d')

                if user_id:
                    cursor.execute("""
                        SELECT id FROM sessions 
                        WHERE user_id = ? AND start_time = ? AND mode = ?
                    """, (user_id, start_time, mode))
                else:
                    cursor.execute("""
                        SELECT id FROM sessions 
                        WHERE user_id IS NULL AND start_time = ? AND mode = ?
                    """, (start_time, mode))

                if not cursor.fetchone():
                    cursor.execute("""
                        INSERT INTO sessions (user_id, mode, duration_minutes, start_time, end_time, status, task_name)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    """, (user_id, mode, duration, start_time, end_time, status, task_name))
                    if mode in ['pomodoro', 'work', 'focus'] and status == 'completed':
                        update_daily_streak_record(cursor, user_id, date_str, duration)

            sqlite_conn.commit()
        except Exception:
            pass

        return jsonify({
            "success": True,
            "message": f"Successfully synced {synced_count} sessions",
            "synced_count": synced_count
        }), 200

    except Exception as err:
        db.session.rollback()
        return jsonify({"success": False, "error": f"Failed to batch sync sessions: {str(err)}"}), 500


@app.route('/api/sessions', methods=['GET'])
def get_sessions():
    """
    Retrieves logged sessions for current user/guest with optional filtering and pagination.
    """
    try:
        limit = min(int(request.args.get('limit', 50)), 200)
        mode = request.args.get('mode')
        status = request.args.get('status')
        user_id = session.get('user_id') or get_current_user_id()

        query = "SELECT * FROM sessions"
        conditions = []
        params = []

        if user_id:
            conditions.append("user_id = ?")
            params.append(user_id)
        else:
            conditions.append("user_id IS NULL")

        if mode:
            if mode in ['pomodoro', 'work', 'focus']:
                conditions.append("mode IN ('pomodoro', 'work', 'focus')")
            else:
                conditions.append("mode = ?")
                params.append(mode)
        if status:
            conditions.append("status = ?")
            params.append(status)

        if conditions:
            query += " WHERE " + " AND ".join(conditions)

        query += " ORDER BY id DESC LIMIT ?"
        params.append(limit)

        sqlite_conn = get_db()
        cursor = sqlite_conn.cursor()
        cursor.execute(query, params)
        rows = cursor.fetchall()

        sessions = [dict(row) for row in rows]
        return jsonify({"success": True, "count": len(sessions), "sessions": sessions}), 200

    except Exception as err:
        return jsonify({"success": False, "error": f"Failed to retrieve sessions: {str(err)}"}), 500


@app.route('/api/sessions', methods=['DELETE'])
def clear_sessions():
    """Clears all session logs and daily streaks for the current user/guest."""
    try:
        user_id = session.get('user_id') or get_current_user_id()

        # Clear SQLAlchemy records
        try:
            if user_id:
                StudySession.query.filter_by(user_id=user_id).delete()
                DailyStreak.query.filter_by(user_id=user_id).delete()
            else:
                StudySession.query.filter(StudySession.user_id.is_(None)).delete()
                DailyStreak.query.filter(DailyStreak.user_id.is_(None)).delete()
            db.session.commit()
        except Exception:
            db.session.rollback()

        # Clear SQLite records
        sqlite_conn = get_db()
        cursor = sqlite_conn.cursor()
        if user_id:
            cursor.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
            cursor.execute("DELETE FROM daily_streaks WHERE user_id = ?", (user_id,))
        else:
            cursor.execute("DELETE FROM sessions WHERE user_id IS NULL")
            cursor.execute("DELETE FROM daily_streaks WHERE user_id IS NULL")

        sqlite_conn.commit()
        return jsonify({"success": True, "message": "Session history cleared."}), 200
    except Exception as err:
        return jsonify({"success": False, "error": f"Failed to clear sessions: {str(err)}"}), 500


# ----------------------------------------------------------------------
# Statistics Endpoint
# ----------------------------------------------------------------------

@app.route('/api/stats', methods=['GET'])
@app.route('/api/user-stats', methods=['GET'])
def get_statistics():
    """
    Calculates study statistics for current user/guest using PostgreSQL (SQLAlchemy)
    with SQLite fallback.
      - Total study hours and total minutes
      - Completed Pomodoro / Work count
      - Total sessions count (all modes)
      - Today's study minutes and pomodoro count
      - 7-day daily activity breakdown for charts
      - Recent session logs (up to 10)
      - Daily streak calculation
    """
    try:
        user_id = session.get('user_id') or get_current_user_id()
        now = datetime.now()
        today_str = now.strftime('%Y-%m-%d')
        focus_modes = ['work', 'pomodoro', 'focus']

        # 1. Primary Query via SQLAlchemy (PostgreSQL / SQLite)
        try:
            query = StudySession.query
            if user_id:
                query = query.filter(StudySession.user_id == user_id)
            else:
                query = query.filter(StudySession.user_id.is_(None))

            # Query all focus sessions with flexible mode and status
            focus_sessions = query.filter(
                StudySession.mode.in_(focus_modes),
                (StudySession.status.in_(['completed', '', None])) | (db.func.lower(StudySession.status) == 'completed')
            ).all()

            total_focus_minutes = round(sum(float(s.duration_minutes or 0) for s in focus_sessions), 1)
            completed_pomodoros = int(total_focus_minutes // 25)
            total_focus_hours = round(total_focus_minutes / 60.0, 2)

            all_sessions = query.all()
            total_sessions = len(all_sessions)

            # Today's Focus Metrics
            today_sessions = [
                s for s in focus_sessions
                if (s.start_time and s.start_time.startswith(today_str)) or
                   (s.created_at and str(s.created_at).startswith(today_str))
            ]
            today_focus_minutes = round(sum(float(s.duration_minutes or 0) for s in today_sessions), 1)
            today_pomodoros = len(today_sessions)

            # 7-Day Weekly Activity Breakdown
            weekly_activity = []
            for i in range(6, -1, -1):
                day_date = now - timedelta(days=i)
                day_str = day_date.strftime('%Y-%m-%d')
                day_name = day_date.strftime('%a')

                day_sessions = [
                    s for s in focus_sessions
                    if (s.start_time and s.start_time.startswith(day_str)) or
                       (s.created_at and str(s.created_at).startswith(day_str))
                ]
                day_mins = round(sum(float(s.duration_minutes or 0) for s in day_sessions), 1)
                weekly_activity.append({
                    "date": day_str,
                    "day_name": day_name,
                    "focus_minutes": day_mins,
                    "completed_count": len(day_sessions)
                })

            # Recent 10 Sessions ordered by id.desc() / created_at.desc()
            recent_objs = query.order_by(StudySession.id.desc()).limit(10).all()
            recent_sessions = []
            for r in recent_objs:
                completed_at = r.end_time or (str(r.created_at) if hasattr(r, 'created_at') else None) or r.start_time
                recent_sessions.append({
                    "id": r.id,
                    "task_title": r.task_name or 'Study Session',
                    "task_name": r.task_name or 'Study Session',
                    "duration_minutes": float(r.duration_minutes or 0),
                    "mode": r.mode,
                    "status": r.status or 'completed',
                    "start_time": r.start_time,
                    "created_at": str(r.created_at) if hasattr(r, 'created_at') else None,
                    "completed_at": completed_at
                })

            # Streak Calculation
            streak_days = 0
            if today_sessions:
                streak_days = 1
            check_offset = 1
            while True:
                past_day = now - timedelta(days=check_offset)
                past_str = past_day.strftime('%Y-%m-%d')
                has_past = any(
                    (s.start_time and s.start_time.startswith(past_str)) or
                    (s.created_at and str(s.created_at).startswith(past_str))
                    for s in focus_sessions
                )
                if has_past:
                    streak_days += 1
                    check_offset += 1
                else:
                    break
                if check_offset > 365:
                    break

            return jsonify({
                "success": True,
                "stats": {
                    "total_focus_minutes": total_focus_minutes,
                    "total_focus_hours": total_focus_hours,
                    "completed_pomodoros": completed_pomodoros,
                    "total_sessions": total_sessions,
                    "today_focus_minutes": today_focus_minutes,
                    "today_pomodoros": today_pomodoros,
                    "current_streak_days": streak_days,
                    "weekly_activity": weekly_activity,
                    "recent_sessions": recent_sessions
                },
                "total_focus_hours": total_focus_hours,
                "total_focus_minutes": total_focus_minutes,
                "completed_pomodoros": completed_pomodoros,
                "total_sessions": total_sessions,
                "today_focus_minutes": today_focus_minutes,
                "today_pomodoros": today_pomodoros,
                "current_streak_days": streak_days,
                "weekly_activity": weekly_activity,
                "recent_sessions": recent_sessions
            }), 200

        except Exception as sa_err:
            app.logger.warning(f"SQLAlchemy query error, executing SQLite fallback: {sa_err}")

        # 2. SQLite direct connection fallback
        sqlite_conn = get_db()
        cursor = sqlite_conn.cursor()

        user_filter = "user_id = ?" if user_id else "user_id IS NULL"
        user_params = (user_id,) if user_id else ()

        # 1. Total Focus Time
        cursor.execute(f"""
            SELECT COALESCE(SUM(duration_minutes), 0) AS total_minutes
            FROM sessions
            WHERE {user_filter} 
              AND mode IN ('pomodoro', 'work', 'focus') 
              AND (status IN ('completed', '') OR status IS NULL OR LOWER(status) = 'completed')
        """, user_params)
        total_row = cursor.fetchone()
        total_focus_minutes = round(float(total_row['total_minutes']), 1)
        completed_pomodoros = int(total_focus_minutes // 25)
        total_focus_hours = round(total_focus_minutes / 60.0, 2)

        # 2. Total Sessions Count
        cursor.execute(f"SELECT COUNT(*) AS total_count FROM sessions WHERE {user_filter}", user_params)
        total_sessions = int(cursor.fetchone()['total_count'])

        # 3. Today's Focus Metrics
        today_params = user_params + (f"{today_str}%", f"{today_str}%")
        cursor.execute(f"""
            SELECT COALESCE(SUM(duration_minutes), 0) AS today_minutes,
                   COUNT(*) AS today_pomodoros
            FROM sessions
            WHERE {user_filter}
              AND mode IN ('pomodoro', 'work', 'focus') 
              AND (status IN ('completed', '') OR status IS NULL OR LOWER(status) = 'completed')
              AND (start_time LIKE ? OR created_at LIKE ?)
        """, today_params)
        today_row = cursor.fetchone()
        today_focus_minutes = round(float(today_row['today_minutes']), 1)
        today_pomodoros = int(today_row['today_pomodoros'])

        # 4. Weekly Activity (Past 7 days breakdown)
        weekly_activity = []
        for i in range(6, -1, -1):
            day_date = now - timedelta(days=i)
            day_str = day_date.strftime('%Y-%m-%d')
            day_name = day_date.strftime('%a')
            day_params = user_params + (f"{day_str}%", f"{day_str}%")

            cursor.execute(f"""
                SELECT COALESCE(SUM(duration_minutes), 0) AS day_minutes,
                       COUNT(*) AS day_count
                FROM sessions
                WHERE {user_filter}
                  AND mode IN ('pomodoro', 'work', 'focus')
                  AND (status IN ('completed', '') OR status IS NULL OR LOWER(status) = 'completed')
                  AND (start_time LIKE ? OR created_at LIKE ?)
            """, day_params)
            day_stat = cursor.fetchone()
            weekly_activity.append({
                "date": day_str,
                "day_name": day_name,
                "focus_minutes": round(float(day_stat['day_minutes']), 1),
                "completed_count": int(day_stat['day_count'])
            })

        # 5. Recent 10 Sessions
        cursor.execute(f"""
            SELECT id, mode, duration_minutes, start_time, end_time, status, task_name, created_at
            FROM sessions
            WHERE {user_filter}
            ORDER BY id DESC
            LIMIT 10
        """, user_params)
        recent_rows = cursor.fetchall()
        recent_sessions = []
        for r in recent_rows:
            time_val = r['end_time'] or r['created_at'] or r['start_time']
            recent_sessions.append({
                "id": r['id'],
                "task_title": r['task_name'] or 'Study Session',
                "task_name": r['task_name'] or 'Study Session',
                "duration_minutes": float(r['duration_minutes']),
                "mode": r['mode'],
                "status": r['status'] or 'completed',
                "start_time": r['start_time'],
                "created_at": r['created_at'],
                "completed_at": time_val
            })

        # 6. Streak Calculation
        streak_days = 0
        test_day = now
        check_params = user_params + (f"{test_day.strftime('%Y-%m-%d')}%", f"{test_day.strftime('%Y-%m-%d')}%")
        cursor.execute(f"""
            SELECT COUNT(*) AS c FROM sessions 
            WHERE {user_filter} AND mode IN ('pomodoro', 'work', 'focus') 
              AND (status IN ('completed', '') OR status IS NULL OR LOWER(status) = 'completed')
              AND (start_time LIKE ? OR created_at LIKE ?)
        """, check_params)
        today_has_activity = cursor.fetchone()['c'] > 0

        check_offset = 1
        if today_has_activity:
            streak_days = 1

        while True:
            past_day = now - timedelta(days=check_offset)
            past_str = past_day.strftime('%Y-%m-%d')
            past_params = user_params + (f"{past_str}%", f"{past_str}%")
            cursor.execute(f"""
                SELECT COUNT(*) AS c FROM sessions 
                WHERE {user_filter} AND mode IN ('pomodoro', 'work', 'focus') 
                  AND (status IN ('completed', '') OR status IS NULL OR LOWER(status) = 'completed')
                  AND (start_time LIKE ? OR created_at LIKE ?)
            """, past_params)
            if cursor.fetchone()['c'] > 0:
                streak_days += 1
                check_offset += 1
            else:
                break
            if check_offset > 365:
                break

        return jsonify({
            "success": True,
            "stats": {
                "total_focus_minutes": total_focus_minutes,
                "total_focus_hours": total_focus_hours,
                "completed_pomodoros": completed_pomodoros,
                "total_sessions": total_sessions,
                "today_focus_minutes": today_focus_minutes,
                "today_pomodoros": today_pomodoros,
                "current_streak_days": streak_days,
                "weekly_activity": weekly_activity,
                "recent_sessions": recent_sessions
            },
            "total_focus_hours": total_focus_hours,
            "total_focus_minutes": total_focus_minutes,
            "completed_pomodoros": completed_pomodoros,
            "total_sessions": total_sessions,
            "today_focus_minutes": today_focus_minutes,
            "today_pomodoros": today_pomodoros,
            "current_streak_days": streak_days,
            "weekly_activity": weekly_activity,
            "recent_sessions": recent_sessions
        }), 200

    except Exception as err:
        return jsonify({"success": False, "error": f"Failed to compute statistics: {str(err)}"}), 500


@app.route('/api/stats/weekly', methods=['GET'])
def get_weekly_stats():
    """
    Returns 7-day focus activity breakdown for current user or guest:
    {
      "days": ["Thu", "Fri", "Sat", "Sun", "Mon", "Tue", "Wed"],
      "minutes": [0, 25, 50, 0, 75, 25, 1],
      "total_weekly_hours": 2.9
    }
    """
    try:
        user_id = session.get('user_id') or get_current_user_id()
        now = datetime.now()
        focus_modes = ['work', 'pomodoro', 'focus']

        # Try SQLAlchemy first
        try:
            query = StudySession.query
            if user_id:
                query = query.filter(StudySession.user_id == user_id)
            else:
                query = query.filter(StudySession.user_id.is_(None))

            focus_sessions = query.filter(
                StudySession.mode.in_(focus_modes),
                (StudySession.status.in_(['completed', '', None])) | (db.func.lower(StudySession.status) == 'completed')
            ).all()

            days = []
            minutes = []
            total_weekly_mins = 0.0

            for i in range(6, -1, -1):
                day_date = now - timedelta(days=i)
                day_str = day_date.strftime('%Y-%m-%d')
                day_name = day_date.strftime('%a')

                day_sessions = [
                    s for s in focus_sessions
                    if (s.start_time and s.start_time.startswith(day_str)) or
                       (s.created_at and str(s.created_at).startswith(day_str))
                ]
                day_mins = round(sum(float(s.duration_minutes or 0) for s in day_sessions), 1)
                days.append(day_name)
                minutes.append(day_mins)
                total_weekly_mins += day_mins

            total_weekly_hours = round(total_weekly_mins / 60.0, 1)

            return jsonify({
                "success": True,
                "days": days,
                "minutes": minutes,
                "total_weekly_hours": total_weekly_hours
            }), 200

        except Exception as sa_err:
            app.logger.warning(f"SQLAlchemy weekly stats error: {sa_err}")

        # SQLite fallback
        sqlite_conn = get_db()
        cursor = sqlite_conn.cursor()

        user_filter = "user_id = ?" if user_id else "user_id IS NULL"
        user_params = (user_id,) if user_id else ()

        days = []
        minutes = []
        total_weekly_mins = 0.0

        for i in range(6, -1, -1):
            day_date = now - timedelta(days=i)
            day_str = day_date.strftime('%Y-%m-%d')
            day_name = day_date.strftime('%a')
            day_params = user_params + (f"{day_str}%", f"{day_str}%")

            cursor.execute(f"""
                SELECT COALESCE(SUM(duration_minutes), 0) AS day_minutes
                FROM sessions
                WHERE {user_filter}
                  AND mode IN ('pomodoro', 'work', 'focus') 
                  AND (status IN ('completed', '') OR status IS NULL OR LOWER(status) = 'completed')
                  AND (start_time LIKE ? OR created_at LIKE ?)
            """, day_params)
            day_stat = cursor.fetchone()
            day_mins = round(float(day_stat['day_minutes']), 1)
            days.append(day_name)
            minutes.append(day_mins)
            total_weekly_mins += day_mins

        total_weekly_hours = round(total_weekly_mins / 60.0, 1)

        return jsonify({
            "success": True,
            "days": days,
            "minutes": minutes,
            "total_weekly_hours": total_weekly_hours
        }), 200

    except Exception as err:
        return jsonify({"success": False, "error": f"Failed to calculate weekly stats: {str(err)}"}), 500


@app.route('/api/sessions/recent', methods=['GET'])
def get_recent_sessions():
    """
    Fetches the most recent sessions for the current user.
    Returns: [{ id, task_title, duration_minutes, mode, status, completed_at }]
    """
    try:
        user_id = session.get('user_id') or get_current_user_id()
        limit = request.args.get('limit', default=5, type=int)

        # Try SQLAlchemy first
        try:
            query = StudySession.query
            if user_id:
                query = query.filter(StudySession.user_id == user_id)
            else:
                query = query.filter(StudySession.user_id.is_(None))

            recent_objs = query.order_by(StudySession.id.desc()).limit(limit).all()
            recent = []
            for r in recent_objs:
                completed_at = r.end_time or (str(r.created_at) if hasattr(r, 'created_at') else None) or r.start_time
                recent.append({
                    "id": r.id,
                    "task_title": r.task_name or 'Study Session',
                    "task_name": r.task_name or 'Study Session',
                    "duration_minutes": float(r.duration_minutes or 0),
                    "mode": r.mode,
                    "status": r.status or 'completed',
                    "start_time": r.start_time,
                    "created_at": str(r.created_at) if hasattr(r, 'created_at') else None,
                    "completed_at": completed_at
                })

            return jsonify(recent), 200

        except Exception as sa_err:
            app.logger.warning(f"SQLAlchemy recent sessions error: {sa_err}")

        # SQLite fallback
        sqlite_conn = get_db()
        cursor = sqlite_conn.cursor()

        user_filter = "user_id = ?" if user_id else "user_id IS NULL"
        user_params = (user_id,) if user_id else ()

        cursor.execute(f"""
            SELECT id, task_name, duration_minutes, mode, start_time, end_time, status, created_at
            FROM sessions
            WHERE {user_filter}
            ORDER BY id DESC
            LIMIT ?
        """, user_params + (limit,))
        rows = cursor.fetchall()
        recent = []
        for r in rows:
            completed_at = r['end_time'] or r['created_at'] or r['start_time']
            recent.append({
                "id": r['id'],
                "task_title": r['task_name'] or 'Study Session',
                "task_name": r['task_name'] or 'Study Session',
                "duration_minutes": float(r['duration_minutes']),
                "mode": r['mode'],
                "status": r['status'] or 'completed',
                "start_time": r['start_time'],
                "created_at": r['created_at'],
                "completed_at": completed_at
            })

        return jsonify(recent), 200

    except Exception as err:
        return jsonify({"success": False, "error": f"Failed to retrieve recent sessions: {str(err)}"}), 500


# ----------------------------------------------------------------------
# User Preferences Endpoints
# ----------------------------------------------------------------------

@app.route('/api/preferences', methods=['GET'])
def get_preferences():
    """Retrieves stored user preferences (user-specific or guest global)."""
    try:
        user_id = get_current_user_id()
        db = get_db()
        cursor = db.cursor()

        if user_id:
            cursor.execute("SELECT key, value FROM user_preferences WHERE user_id = ?", (user_id,))
        else:
            cursor.execute("SELECT key, value FROM preferences")

        rows = cursor.fetchall()
        prefs = {row['key']: row['value'] for row in rows}
        return jsonify({"success": True, "preferences": prefs}), 200
    except Exception as err:
        return jsonify({"success": False, "error": f"Failed to load preferences: {str(err)}"}), 500


@app.route('/api/preferences', methods=['POST'])
def save_preferences():
    """Saves or updates user preferences."""
    data = request.get_json()
    if not data or not isinstance(data, dict):
        return jsonify({"success": False, "error": "Expected a JSON object of key-value preferences"}), 400

    try:
        user_id = get_current_user_id()
        db = get_db()
        cursor = db.cursor()

        for key, value in data.items():
            if user_id:
                cursor.execute("""
                    INSERT INTO user_preferences (user_id, key, value, updated_at)
                    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                    ON CONFLICT(user_id, key) DO UPDATE SET 
                        value=excluded.value,
                        updated_at=CURRENT_TIMESTAMP
                """, (user_id, str(key), str(value)))
            else:
                cursor.execute("""
                    INSERT INTO preferences (key, value, updated_at)
                    VALUES (?, ?, CURRENT_TIMESTAMP)
                    ON CONFLICT(key) DO UPDATE SET 
                        value=excluded.value,
                        updated_at=CURRENT_TIMESTAMP
                """, (str(key), str(value)))

        db.commit()
        return jsonify({"success": True, "message": "Preferences saved successfully"}), 200
    except Exception as err:
        return jsonify({"success": False, "error": f"Failed to save preferences: {str(err)}"}), 500


# ----------------------------------------------------------------------
# Feedback & Feature Requests Endpoint
# ----------------------------------------------------------------------

@app.route('/api/feedback', methods=['POST'])
@limiter.limit("10 per minute; 60 per hour")
def submit_feedback():
    """
    Submits user feedback and feature requests to PostgreSQL / SQLite database.
    Supports both JSON payloads and Form Data safely with data type validation and length truncation.
    Expects payload/form: { feedback_type / type, message, email }
    """
    raw_data = request.get_json(silent=True)
    if raw_data is None:
        data = request.form.to_dict() if request.form else {}
    elif isinstance(raw_data, dict):
        data = raw_data
    else:
        return jsonify({"success": False, "error": "Invalid request payload format. Expected JSON object or form data."}), 400

    raw_message = data.get('message')
    if raw_message is None or not isinstance(raw_message, str):
        return jsonify({"success": False, "error": "Message must be a text string."}), 400

    message = raw_message.strip()
    if not message:
        return jsonify({"success": False, "error": "Message cannot be empty."}), 400

    # Truncate message payload (max 1000 chars)
    if len(message) > 1000:
        message = message[:1000]

    raw_type = data.get('feedback_type') or data.get('type')
    if raw_type is not None and not isinstance(raw_type, str):
        return jsonify({"success": False, "error": "Feedback type must be a text string."}), 400
    feedback_type = (raw_type or 'General Feedback').strip()
    if len(feedback_type) > 100:
        feedback_type = feedback_type[:100]

    raw_email = data.get('email') or data.get('user_email')
    if raw_email is not None and not isinstance(raw_email, str):
        return jsonify({"success": False, "error": "Email must be a text string."}), 400
    user_email = (raw_email or '').strip() or None
    if user_email and len(user_email) > 255:
        user_email = user_email[:255]

    try:
        user_id = session.get('user_id') or get_current_user_id()
        if user_id and not user_email:
            user = db.session.get(User, user_id)
            if user:
                user_email = user.email

        new_feedback = Feedback(
            user_id=user_id,
            user_email=user_email,
            feedback_type=feedback_type,
            message=message,
            created_at=datetime.now(timezone.utc)
        )
        db.session.add(new_feedback)
        db.session.commit()

        # SQLite direct insert fallback if active
        try:
            sqlite_conn = get_db()
            cursor = sqlite_conn.cursor()
            cursor.execute("""
                INSERT INTO feedbacks (user_id, user_email, feedback_type, message)
                VALUES (?, ?, ?, ?)
            """, (user_id, user_email, feedback_type, message))
            sqlite_conn.commit()
        except Exception:
            pass

        return jsonify({"success": True, "message": "Feedback received!"}), 200

    except Exception as err:
        db.session.rollback()
        return jsonify({"success": False, "error": f"Failed to submit feedback: {str(err)}"}), 500


# ----------------------------------------------------------------------
# Application Entry Point
# ----------------------------------------------------------------------

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    is_production = (
        os.environ.get('FLASK_ENV') == 'production'
        or os.environ.get('ENVIRONMENT') == 'production'
        or bool(os.environ.get('DYNO'))
        or os.environ.get('FLASK_DEBUG', '').lower() in ('false', '0', 'no')
    )
    # Strictly enforce debug=False in production
    debug_mode = False if is_production else (os.environ.get('FLASK_DEBUG', 'false').lower() in ('true', '1'))
    app.run(host='0.0.0.0', port=port, debug=debug_mode)
