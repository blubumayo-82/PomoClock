"""
PomoHaven - Cozy & Deep Study Flow Pomodoro Backend Application
Flask application providing SQLite persistence, optional user authentication,
Guest Mode fallback, productivity statistics calculation, and user preferences management.
"""

import os
import re
import sqlite3
from datetime import datetime, timedelta, timezone
from flask import Flask, render_template, request, jsonify, g, session
from werkzeug.security import generate_password_hash, check_password_hash

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
app.config['SESSION_COOKIE_SECURE'] = True if (os.environ.get('DYNO') or os.environ.get('SESSION_COOKIE_SECURE', '').lower() in ('true', '1') or os.environ.get('FLASK_ENV') == 'production') else False
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'

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
    google_id = db.Column(db.String(100), nullable=True)
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
        user = User.query.filter_by(email=email).first()
        if not user:
            user = User(
                email=email,
                name=name,
                username=name,
                google_id=google_id,
                avatar_url=avatar_url,
                password_hash='',
                auth_provider='google'
            )
            db.session.add(user)
            db.session.commit()
        else:
            if google_id and not user.google_id:
                user.google_id = google_id
            if avatar_url and not user.avatar_url:
                user.avatar_url = avatar_url
            if name and not user.name:
                user.name = name
            db.session.commit()

        # Synchronize SQLite users table if running direct queries
        try:
            db_conn = get_db()
            cursor = db_conn.cursor()
            cursor.execute("SELECT id FROM users WHERE LOWER(email) = ?", (email,))
            if not cursor.fetchone():
                cursor.execute("""
                    INSERT INTO users (id, username, name, email, avatar_url, auth_provider, google_id)
                    VALUES (?, ?, ?, ?, ?, 'google', ?)
                """, (user.id, user.username or name, user.name or name, email, avatar_url or '', google_id))
                db_conn.commit()
            else:
                cursor.execute("""
                    UPDATE users SET google_id = COALESCE(google_id, ?), name = COALESCE(?, name), avatar_url = COALESCE(?, avatar_url)
                    WHERE LOWER(email) = ?
                """, (google_id, name, avatar_url, email))
                db_conn.commit()
        except Exception:
            pass

        session.permanent = True
        session['user_id'] = user.id

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

    db = get_db()
    cursor = db.cursor()

    # Check if email is already taken
    cursor.execute("SELECT id FROM users WHERE LOWER(email) = ?", (email,))
    if cursor.fetchone():
        return jsonify({"success": False, "error": "An account with this email already exists"}), 409

    # Hash password with scrypt/pbkdf2
    pwd_hash = generate_password_hash(password)

    try:
        cursor.execute("""
            INSERT INTO users (username, name, email, password_hash, auth_provider)
            VALUES (?, ?, ?, ?, 'local')
        """, (username, username, email, pwd_hash))
        db.commit()

        user_id = cursor.lastrowid
        session.permanent = True
        session['user_id'] = user_id

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
                "created_at": datetime.now(timezone.utc).isoformat()
            }
        }), 201

    except Exception as err:
        return jsonify({"success": False, "error": f"Failed to create account: {str(err)}"}), 500


@app.route('/api/auth/login', methods=['POST'])
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

    db = get_db()
    cursor = db.cursor()
    cursor.execute("""
        SELECT id, username, name, email, password_hash, avatar_url, auth_provider, created_at 
        FROM users 
        WHERE LOWER(email) = ? OR LOWER(username) = ? OR LOWER(name) = ?
    """, (login_identifier, login_identifier, login_identifier))
    user = cursor.fetchone()

    if not user:
        return jsonify({"success": False, "error": "Invalid email/username or password"}), 401

    if not user['password_hash']:
        if user['auth_provider'] == 'google':
            return jsonify({"success": False, "error": "This account was created with Google Sign-In. Please sign in with Google."}), 400
        return jsonify({"success": False, "error": "Account has no password set"}), 401

    if not check_password_hash(user['password_hash'], password):
        return jsonify({"success": False, "error": "Invalid email/username or password"}), 401

    session.permanent = True
    session['user_id'] = user['id']
    display_name = user['name'] or user['username'] or user['email'].split('@')[0]

    return jsonify({
        "success": True,
        "message": "Login successful",
        "user": {
            "id": user['id'],
            "username": display_name,
            "name": display_name,
            "email": user['email'],
            "avatar_url": user['avatar_url'] or '',
            "auth_provider": user['auth_provider'] or 'local',
            "created_at": user['created_at']
        }
    }), 200


@app.route('/api/auth/logout', methods=['POST'])
def logout():
    """Logs out current user session."""
    session.clear()
    return jsonify({"success": True, "message": "Logged out successfully"}), 200


@app.route('/api/auth/me', methods=['GET'])
def get_current_user():
    """Returns authentication status and current user profile if logged in."""
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({"authenticated": False, "user": None}), 200

    db = get_db()
    cursor = db.cursor()
    cursor.execute("""
        SELECT id, username, name, email, avatar_url, auth_provider, created_at 
        FROM users 
        WHERE id = ?
    """, (user_id,))
    user = cursor.fetchone()

    if not user:
        session.clear()
        return jsonify({"authenticated": False, "user": None}), 200

    display_name = user['name'] or user['username'] or user['email'].split('@')[0]

    return jsonify({
        "authenticated": True,
        "user": {
            "id": user['id'],
            "username": display_name,
            "name": display_name,
            "email": user['email'],
            "avatar_url": user['avatar_url'] or '',
            "auth_provider": user['auth_provider'] or 'local',
            "created_at": user['created_at']
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


@app.route('/api/sessions', methods=['POST'])
def record_session():
    """
    Records a completed, skipped, or interrupted timer session.
    Automatically attaches user_id if authenticated, or logs as guest.
    """
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "error": "Invalid or missing JSON payload"}), 400

    mode = data.get('mode', 'pomodoro')
    allowed_modes = ['pomodoro', 'short_break', 'long_break']
    if mode not in allowed_modes:
        return jsonify({"success": False, "error": f"Invalid mode. Allowed: {allowed_modes}"}), 400

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
    user_id = get_current_user_id() or data.get('user_id')

    try:
        db = get_db()
        cursor = db.cursor()
        cursor.execute("""
            INSERT INTO sessions (user_id, mode, duration_minutes, start_time, end_time, status, task_name)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (user_id, mode, duration_minutes, start_time, end_time, status, task_name))
        db.commit()

        session_id = cursor.lastrowid

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

    except Exception as err:
        return jsonify({"success": False, "error": f"Database insertion error: {str(err)}"}), 500


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
    user_id = get_current_user_id()

    db = get_db()
    cursor = db.cursor()
    synced_count = 0

    try:
        for item in sessions_to_sync:
            mode = item.get('mode', 'pomodoro')
            duration = float(item.get('duration_minutes', 25.0))
            start_time = item.get('start_time') or datetime.now(timezone.utc).isoformat()
            end_time = item.get('end_time') or start_time
            status = item.get('status', 'completed')
            task_name = (item.get('task_name') or 'Study Session').strip()[:100]

            # Check if this exact session already exists to avoid duplicate entries
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
                synced_count += 1

        db.commit()
        return jsonify({
            "success": True,
            "message": f"Successfully synced {synced_count} sessions",
            "synced_count": synced_count
        }), 200

    except Exception as err:
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
        user_id = get_current_user_id()

        query = "SELECT * FROM sessions"
        conditions = []
        params = []

        if user_id:
            conditions.append("user_id = ?")
            params.append(user_id)
        else:
            conditions.append("user_id IS NULL")

        if mode:
            conditions.append("mode = ?")
            params.append(mode)
        if status:
            conditions.append("status = ?")
            params.append(status)

        if conditions:
            query += " WHERE " + " AND ".join(conditions)

        query += " ORDER BY id DESC LIMIT ?"
        params.append(limit)

        db = get_db()
        cursor = db.cursor()
        cursor.execute(query, params)
        rows = cursor.fetchall()

        sessions = [dict(row) for row in rows]
        return jsonify({"success": True, "count": len(sessions), "sessions": sessions}), 200

    except Exception as err:
        return jsonify({"success": False, "error": f"Failed to retrieve sessions: {str(err)}"}), 500


@app.route('/api/sessions', methods=['DELETE'])
def clear_sessions():
    """Clears all session logs for the current user/guest."""
    try:
        user_id = get_current_user_id()
        db = get_db()
        cursor = db.cursor()

        if user_id:
            cursor.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
        else:
            cursor.execute("DELETE FROM sessions WHERE user_id IS NULL")

        db.commit()
        return jsonify({"success": True, "message": "Session history cleared."}), 200
    except Exception as err:
        return jsonify({"success": False, "error": f"Failed to clear sessions: {str(err)}"}), 500


# ----------------------------------------------------------------------
# Statistics Endpoint
# ----------------------------------------------------------------------

@app.route('/api/stats', methods=['GET'])
def get_statistics():
    """
    Calculates study statistics for current user/guest:
      - Total study hours and total minutes
      - Completed Pomodoro count
      - Total sessions count (all modes)
      - Today's study minutes and pomodoro count
      - 7-day daily activity breakdown for charts
      - Recent session logs
    """
    try:
        user_id = get_current_user_id()
        db = get_db()
        cursor = db.cursor()

        user_filter = "user_id = ?" if user_id else "user_id IS NULL"
        user_params = (user_id,) if user_id else ()

        # 1. Total Focus Time
        cursor.execute(f"""
            SELECT COALESCE(SUM(duration_minutes), 0) AS total_minutes,
                   COUNT(*) AS completed_pomodoros
            FROM sessions
            WHERE {user_filter} AND mode = 'pomodoro' AND status = 'completed'
        """, user_params)
        total_row = cursor.fetchone()
        total_focus_minutes = round(float(total_row['total_minutes']), 1)
        completed_pomodoros = int(total_row['completed_pomodoros'])
        total_focus_hours = round(total_focus_minutes / 60.0, 2)

        # 2. Total Sessions Count
        cursor.execute(f"SELECT COUNT(*) AS total_count FROM sessions WHERE {user_filter}", user_params)
        total_sessions = int(cursor.fetchone()['total_count'])

        # 3. Today's Focus Metrics
        today_str = datetime.now().strftime('%Y-%m-%d')
        today_params = user_params + (f"{today_str}%",)
        cursor.execute(f"""
            SELECT COALESCE(SUM(duration_minutes), 0) AS today_minutes,
                   COUNT(*) AS today_pomodoros
            FROM sessions
            WHERE {user_filter}
              AND mode = 'pomodoro' 
              AND status = 'completed' 
              AND start_time LIKE ?
        """, today_params)
        today_row = cursor.fetchone()
        today_focus_minutes = round(float(today_row['today_minutes']), 1)
        today_pomodoros = int(today_row['today_pomodoros'])

        # 4. Weekly Activity (Past 7 days breakdown)
        weekly_activity = []
        now = datetime.now()
        for i in range(6, -1, -1):
            day_date = now - timedelta(days=i)
            day_str = day_date.strftime('%Y-%m-%d')
            day_name = day_date.strftime('%a')
            day_params = user_params + (f"{day_str}%",)

            cursor.execute(f"""
                SELECT COALESCE(SUM(duration_minutes), 0) AS day_minutes,
                       COUNT(*) AS day_count
                FROM sessions
                WHERE {user_filter}
                  AND mode = 'pomodoro'
                  AND status = 'completed'
                  AND start_time LIKE ?
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
            SELECT id, mode, duration_minutes, start_time, end_time, status, task_name
            FROM sessions
            WHERE {user_filter}
            ORDER BY id DESC
            LIMIT 10
        """, user_params)
        recent_rows = cursor.fetchall()
        recent_sessions = [dict(r) for r in recent_rows]

        # 6. Streak Calculation
        streak_days = 0
        test_day = now
        check_params = user_params + (f"{test_day.strftime('%Y-%m-%d')}%",)
        cursor.execute(f"""
            SELECT COUNT(*) AS c FROM sessions 
            WHERE {user_filter} AND mode = 'pomodoro' AND status = 'completed' AND start_time LIKE ?
        """, check_params)
        today_has_activity = cursor.fetchone()['c'] > 0

        check_offset = 1
        if today_has_activity:
            streak_days = 1

        while True:
            past_day = now - timedelta(days=check_offset)
            past_str = past_day.strftime('%Y-%m-%d')
            past_params = user_params + (f"{past_str}%",)
            cursor.execute(f"""
                SELECT COUNT(*) AS c FROM sessions 
                WHERE {user_filter} AND mode = 'pomodoro' AND status = 'completed' AND start_time LIKE ?
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
            }
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
        db = get_db()
        cursor = db.cursor()

        user_filter = "user_id = ?" if user_id else "user_id IS NULL"
        user_params = (user_id,) if user_id else ()

        now = datetime.now()
        days = []
        minutes = []
        total_weekly_mins = 0.0

        for i in range(6, -1, -1):
            day_date = now - timedelta(days=i)
            day_str = day_date.strftime('%Y-%m-%d')
            day_name = day_date.strftime('%a')
            day_params = user_params + (f"{day_str}%",)

            cursor.execute(f"""
                SELECT COALESCE(SUM(duration_minutes), 0) AS day_minutes
                FROM sessions
                WHERE {user_filter}
                  AND mode = 'pomodoro' 
                  AND status = 'completed' 
                  AND start_time LIKE ?
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
    Fetches the 5 most recent sessions for the current user.
    Returns: [{ id, task_title, duration_minutes, mode, completed_at }]
    """
    try:
        user_id = session.get('user_id') or get_current_user_id()
        db = get_db()
        cursor = db.cursor()

        user_filter = "user_id = ?" if user_id else "user_id IS NULL"
        user_params = (user_id,) if user_id else ()

        cursor.execute(f"""
            SELECT id, task_name, duration_minutes, mode, start_time, end_time, status, created_at
            FROM sessions
            WHERE {user_filter}
            ORDER BY id DESC
            LIMIT 5
        """, user_params)
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
                "status": r['status'],
                "start_time": r['start_time'],
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
def submit_feedback():
    """
    Submits user feedback and feature requests to PostgreSQL / SQLite database.
    Expects JSON: { feedback_type, message, email }
    """
    data = request.get_json() or {}
    message = (data.get('message') or '').strip()
    feedback_type = (data.get('feedback_type') or 'Feature Request').strip()
    user_email = (data.get('email') or data.get('user_email') or '').strip()

    if not message:
        return jsonify({"success": False, "error": "Message cannot be empty."}), 400

    try:
        user_id = session.get('user_id') or get_current_user_id()
        if user_id and not user_email:
            user = User.query.get(user_id)
            if user:
                user_email = user.email

        feedback = Feedback(
            user_id=user_id,
            user_email=user_email or None,
            feedback_type=feedback_type,
            message=message
        )
        db.session.add(feedback)
        db.session.commit()

        # SQLite direct insert fallback if active
        try:
            db_conn = get_db()
            cursor = db_conn.cursor()
            cursor.execute("""
                INSERT INTO feedbacks (user_id, user_email, feedback_type, message)
                VALUES (?, ?, ?, ?)
            """, (user_id, user_email or None, feedback_type, message))
            db_conn.commit()
        except Exception:
            pass

        return jsonify({"success": True, "message": "Thank you for your feedback!"}), 200

    except Exception as err:
        db.session.rollback()
        return jsonify({"success": False, "error": f"Failed to submit feedback: {str(err)}"}), 500


# ----------------------------------------------------------------------
# Application Entry Point
# ----------------------------------------------------------------------

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
