"""
PomoClock - Pomodoro Study Timer Backend Application
Flask application providing SQLite persistence, optional user authentication,
Guest Mode fallback, productivity statistics calculation, and user preferences management.
"""

import os
import re
import sqlite3
from datetime import datetime, timedelta, timezone
from flask import Flask, render_template, request, jsonify, g, session
from werkzeug.security import generate_password_hash, check_password_hash

# Initialize Flask application
app = Flask(__name__, static_folder='static', template_folder='templates')
app.secret_key = os.environ.get('SECRET_KEY', 'pomoclock-study-secret-key-2026')

# Database path configuration
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DATABASE = os.path.join(BASE_DIR, 'pomodoro.db')


def get_db():
    """
    Get or create a database connection for the current application context.
    Configures row factory to return dict-like sqlite3.Row objects.
    """
    if 'db' not in g:
        g.db = sqlite3.connect(DATABASE)
        g.db.row_factory = sqlite3.Row
        # Enable WAL mode for high concurrency and write speed
        g.db.execute("PRAGMA journal_mode=WAL;")
    return g.db


@app.teardown_appcontext
def close_db(exception):
    """Closes the database connection at the end of the request context."""
    db = g.pop('db', None)
    if db is not None:
        db.close()


def init_db():
    """
    Initializes database tables if they do not exist.
    Creates 'users', 'sessions', 'preferences', and 'user_preferences' tables.
    """
    db = sqlite3.connect(DATABASE)
    cursor = db.cursor()

    # Create users table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
    """)

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

    db.commit()
    db.close()


# Ensure DB schema is ready at startup
init_db()


def get_current_user_id():
    """Returns the authenticated user's ID from Flask session, or None for Guest."""
    return session.get('user_id')


# ----------------------------------------------------------------------
# Page Routes
# ----------------------------------------------------------------------

@app.route('/')
def index():
    """Renders the main Pomodoro Study Timer single-page application."""
    return render_template('index.html')


# ----------------------------------------------------------------------
# Authentication Endpoints
# ----------------------------------------------------------------------

@app.route('/api/auth/register', methods=['POST'])
def register():
    """
    Registers a new user account.
    Payload: {"username": "...", "email": "...", "password": "..."}
    """
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "error": "Missing registration data"}), 400

    username = (data.get('username') or '').strip()
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''

    # Validation
    if len(username) < 3 or len(username) > 30:
        return jsonify({"success": False, "error": "Username must be between 3 and 30 characters"}), 400

    if not re.match(r"[^@]+@[^@]+\.[^@]+", email):
        return jsonify({"success": False, "error": "Please provide a valid email address"}), 400

    if len(password) < 6:
        return jsonify({"success": False, "error": "Password must be at least 6 characters"}), 400

    db = get_db()
    cursor = db.cursor()

    # Check for duplicate username or email
    cursor.execute("SELECT id FROM users WHERE username = ? OR email = ?", (username, email))
    existing = cursor.fetchone()
    if existing:
        return jsonify({"success": False, "error": "Username or email already registered"}), 409

    password_hash = generate_password_hash(password)

    try:
        cursor.execute("""
            INSERT INTO users (username, email, password_hash)
            VALUES (?, ?, ?)
        """, (username, email, password_hash))
        db.commit()

        user_id = cursor.lastrowid
        session['user_id'] = user_id

        return jsonify({
            "success": True,
            "message": "Account created successfully",
            "user": {
                "id": user_id,
                "username": username,
                "email": email
            }
        }), 201

    except Exception as err:
        return jsonify({"success": False, "error": f"Registration failed: {str(err)}"}), 500


@app.route('/api/auth/login', methods=['POST'])
def login():
    """
    Authenticates an existing user via username/email and password.
    Payload: {"login": "email_or_username", "password": "..."}
    """
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "error": "Missing login credentials"}), 400

    login_identifier = (data.get('login') or '').strip().lower()
    password = data.get('password') or ''

    if not login_identifier or not password:
        return jsonify({"success": False, "error": "Username/email and password are required"}), 400

    db = get_db()
    cursor = db.cursor()
    cursor.execute("""
        SELECT id, username, email, password_hash 
        FROM users 
        WHERE LOWER(username) = ? OR LOWER(email) = ?
    """, (login_identifier, login_identifier))
    user = cursor.fetchone()

    if not user or not check_password_hash(user['password_hash'], password):
        return jsonify({"success": False, "error": "Invalid username/email or password"}), 401

    session['user_id'] = user['id']

    return jsonify({
        "success": True,
        "message": "Login successful",
        "user": {
            "id": user['id'],
            "username": user['username'],
            "email": user['email']
        }
    }), 200


@app.route('/api/auth/logout', methods=['POST'])
def logout():
    """Logs out current user session."""
    session.pop('user_id', None)
    return jsonify({"success": True, "message": "Logged out successfully"}), 200


@app.route('/api/auth/me', methods=['GET'])
def get_current_user():
    """Returns authentication status and current user profile if logged in."""
    user_id = get_current_user_id()
    if not user_id:
        return jsonify({"authenticated": False, "user": None}), 200

    db = get_db()
    cursor = db.cursor()
    cursor.execute("SELECT id, username, email, created_at FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()

    if not user:
        session.pop('user_id', None)
        return jsonify({"authenticated": False, "user": None}), 200

    return jsonify({
        "authenticated": True,
        "user": {
            "id": user['id'],
            "username": user['username'],
            "email": user['email'],
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
    user_id = get_current_user_id()

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
# Application Entry Point
# ----------------------------------------------------------------------

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
