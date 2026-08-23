"""
Pomodoro Study Timer - Backend Application
Flask application providing SQLite persistence, RESTful API endpoints for study sessions,
productivity statistics calculation, and user preferences management.
"""

import os
import sqlite3
from datetime import datetime, timedelta, timezone
from flask import Flask, render_template, request, jsonify, g

# Initialize Flask application
app = Flask(__name__, static_folder='static', template_folder='templates')

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
    Creates 'sessions' table for pomodoro logs and 'preferences' for custom settings.
    """
    db = sqlite3.connect(DATABASE)
    cursor = db.cursor()

    # Create sessions table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mode TEXT NOT NULL,
            duration_minutes REAL NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT,
            status TEXT NOT NULL DEFAULT 'completed',
            task_name TEXT DEFAULT 'Study Session',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # Index for fast aggregation on mode, status, and start_time
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_sessions_query 
        ON sessions(mode, status, start_time);
    """)

    # Create preferences table for key-value storage
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS preferences (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
    """)

    db.commit()
    db.close()


# Ensure DB schema is ready at startup
init_db()


# ----------------------------------------------------------------------
# Page Routes
# ----------------------------------------------------------------------

@app.route('/')
def index():
    """Renders the main Pomodoro Study Timer single-page application."""
    return render_template('index.html')


# ----------------------------------------------------------------------
# REST API Endpoints
# ----------------------------------------------------------------------

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint to verify backend service status."""
    return jsonify({
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }), 200


@app.route('/api/sessions', methods=['POST'])
def record_session():
    """
    Records a completed, skipped, or interrupted timer session.
    Payload:
        {
            "mode": "pomodoro" | "short_break" | "long_break",
            "duration_minutes": float,
            "start_time": ISO8601 string,
            "end_time": ISO8601 string,
            "status": "completed" | "skipped" | "interrupted",
            "task_name": string (optional)
        }
    """
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "error": "Invalid or missing JSON payload"}), 400

    # Validation
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

    start_time = data.get('start_time')
    if not start_time:
        start_time = datetime.now(timezone.utc).isoformat()

    end_time = data.get('end_time')
    if not end_time:
        end_time = datetime.now(timezone.utc).isoformat()

    status = data.get('status', 'completed')
    allowed_statuses = ['completed', 'skipped', 'interrupted']
    if status not in allowed_statuses:
        status = 'completed'

    task_name = (data.get('task_name') or 'Study Session').strip()[:100]

    try:
        db = get_db()
        cursor = db.cursor()
        cursor.execute("""
            INSERT INTO sessions (mode, duration_minutes, start_time, end_time, status, task_name)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (mode, duration_minutes, start_time, end_time, status, task_name))
        db.commit()

        session_id = cursor.lastrowid

        return jsonify({
            "success": True,
            "message": "Session recorded successfully",
            "session": {
                "id": session_id,
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


@app.route('/api/sessions', methods=['GET'])
def get_sessions():
    """
    Retrieves logged sessions with optional filtering and pagination.
    Query params:
        limit: int (default 50, max 200)
        mode: string (optional)
        status: string (optional)
    """
    try:
        limit = min(int(request.args.get('limit', 50)), 200)
        mode = request.args.get('mode')
        status = request.args.get('status')

        query = "SELECT * FROM sessions"
        conditions = []
        params = []

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
    """Clears all session logs from the database."""
    try:
        db = get_db()
        cursor = db.cursor()
        cursor.execute("DELETE FROM sessions")
        db.commit()
        return jsonify({"success": True, "message": "All session logs have been cleared."}), 200
    except Exception as err:
        return jsonify({"success": False, "error": f"Failed to clear sessions: {str(err)}"}), 500


@app.route('/api/stats', methods=['GET'])
def get_statistics():
    """
    Calculates study statistics:
      - Total study hours and total minutes
      - Completed Pomodoro count
      - Total sessions count (all modes)
      - Today's study minutes and pomodoro count
      - 7-day daily activity breakdown for charts
      - Recent session logs
    """
    try:
        db = get_db()
        cursor = db.cursor()

        # 1. Total Focus Time (only completed 'pomodoro' sessions)
        cursor.execute("""
            SELECT COALESCE(SUM(duration_minutes), 0) AS total_minutes,
                   COUNT(*) AS completed_pomodoros
            FROM sessions
            WHERE mode = 'pomodoro' AND status = 'completed'
        """)
        total_row = cursor.fetchone()
        total_focus_minutes = round(float(total_row['total_minutes']), 1)
        completed_pomodoros = int(total_row['completed_pomodoros'])
        total_focus_hours = round(total_focus_minutes / 60.0, 2)

        # 2. Total Sessions Count (all modes and statuses)
        cursor.execute("SELECT COUNT(*) AS total_count FROM sessions")
        total_sessions = int(cursor.fetchone()['total_count'])

        # 3. Today's Focus Metrics (based on local date prefix)
        today_str = datetime.now().strftime('%Y-%m-%d')
        cursor.execute("""
            SELECT COALESCE(SUM(duration_minutes), 0) AS today_minutes,
                   COUNT(*) AS today_pomodoros
            FROM sessions
            WHERE mode = 'pomodoro' 
              AND status = 'completed' 
              AND start_time LIKE ?
        """, (f"{today_str}%",))
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

            cursor.execute("""
                SELECT COALESCE(SUM(duration_minutes), 0) AS day_minutes,
                       COUNT(*) AS day_count
                FROM sessions
                WHERE mode = 'pomodoro'
                  AND status = 'completed'
                  AND start_time LIKE ?
            """, (f"{day_str}%",))
            day_stat = cursor.fetchone()
            weekly_activity.append({
                "date": day_str,
                "day_name": day_name,
                "focus_minutes": round(float(day_stat['day_minutes']), 1),
                "completed_count": int(day_stat['day_count'])
            })

        # 5. Recent 10 Sessions
        cursor.execute("""
            SELECT id, mode, duration_minutes, start_time, end_time, status, task_name
            FROM sessions
            ORDER BY id DESC
            LIMIT 10
        """)
        recent_rows = cursor.fetchall()
        recent_sessions = [dict(r) for r in recent_rows]

        # 6. Current Streak Calculation
        # Count consecutive days with at least 1 completed pomodoro going backwards
        streak_days = 0
        test_day = now
        # Check today first
        cursor.execute("""
            SELECT COUNT(*) AS c FROM sessions 
            WHERE mode = 'pomodoro' AND status = 'completed' AND start_time LIKE ?
        """, (f"{test_day.strftime('%Y-%m-%d')}%",))
        today_has_activity = cursor.fetchone()['c'] > 0

        # If today hasn't happened yet, check yesterday to start streak
        if today_has_activity:
            streak_days = 1
            check_offset = 1
        else:
            check_offset = 1

        while True:
            past_day = now - timedelta(days=check_offset)
            past_str = past_day.strftime('%Y-%m-%d')
            cursor.execute("""
                SELECT COUNT(*) AS c FROM sessions 
                WHERE mode = 'pomodoro' AND status = 'completed' AND start_time LIKE ?
            """, (f"{past_str}%",))
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


@app.route('/api/preferences', methods=['GET'])
def get_preferences():
    """Retrieves all stored user preferences."""
    try:
        db = get_db()
        cursor = db.cursor()
        cursor.execute("SELECT key, value FROM preferences")
        rows = cursor.fetchall()
        prefs = {row['key']: row['value'] for row in rows}
        return jsonify({"success": True, "preferences": prefs}), 200
    except Exception as err:
        return jsonify({"success": False, "error": f"Failed to load preferences: {str(err)}"}), 500


@app.route('/api/preferences', methods=['POST'])
def save_preferences():
    """
    Saves or updates user preferences.
    Payload: {"theme": "matcha", "pomodoro_duration": "25", ...}
    """
    data = request.get_json()
    if not data or not isinstance(data, dict):
        return jsonify({"success": False, "error": "Expected a JSON object of key-value preferences"}), 400

    try:
        db = get_db()
        cursor = db.cursor()
        for key, value in data.items():
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
    # Local development server
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
