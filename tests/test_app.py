"""
Unit and Integration Tests for PomoHaven Flask Backend & Authentication
"""

import os
import json
import unittest
import tempfile
from datetime import datetime, timedelta, timezone

import app as flask_app


class PomodoroAppTestCase(unittest.TestCase):
    def setUp(self):
        # Configure app for testing with temporary database
        self.db_fd, self.temp_db_path = tempfile.mkstemp()
        flask_app.DATABASE = self.temp_db_path
        flask_app.app.config['TESTING'] = True
        self.client = flask_app.app.test_client()

        # Initialize schema
        with flask_app.app.app_context():
            flask_app.db.session.remove()
            flask_app.db.drop_all()
            flask_app.db.create_all()
            flask_app.init_db()

    def tearDown(self):
        # Clean up temporary database
        with flask_app.app.app_context():
            flask_app.db.session.remove()
            flask_app.db.drop_all()
        os.close(self.db_fd)
        if os.path.exists(self.temp_db_path):
            try:
                os.unlink(self.temp_db_path)
            except Exception:
                pass

    def test_health_check(self):
        """Test health check endpoint."""
        response = self.client.get('/api/health')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data.get('status'), 'healthy')
        self.assertTrue(data.get('guest_mode'))

    def test_index_page(self):
        """Test index page returns HTML with 200 OK, PomoHaven branding, SEO metadata, GA4, and Privacy & Terms modal."""
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'PomoHaven \xe2\x80\x94 Cozy Pomodoro Timer & Study Focus Tracker', response.data)
        self.assertIn(b'YOUR COZY FOCUS HAVEN', response.data)
        self.assertIn(b'https://pomohaven.com/', response.data)
        self.assertIn(b'G-5X56TCFQ65', response.data)
        self.assertIn(b'style.css?v=6.0', response.data)
        self.assertIn(b'script.js?v=6.0', response.data)
        self.assertIn(b'Privacy & Terms', response.data)
        self.assertIn(b'privacyModal', response.data)
        self.assertIn(b'Data Collection & Authentication', response.data)
        self.assertIn(b'Usage Analytics', response.data)
        self.assertIn(b'Data Control & Ownership', response.data)

    def test_robots_txt(self):
        """Test robots.txt returns valid crawling directives and sitemap reference."""
        response = self.client.get('/robots.txt')
        self.assertEqual(response.status_code, 200)
        self.assertIn('text/plain', response.content_type)
        self.assertIn(b'User-agent: *', response.data)
        self.assertIn(b'Allow: /', response.data)
        self.assertIn(b'Sitemap: https://pomohaven.com/sitemap.xml', response.data)

    def test_sitemap_xml(self):
        """Test sitemap.xml returns valid XML sitemap."""
        response = self.client.get('/sitemap.xml')
        self.assertEqual(response.status_code, 200)
        self.assertIn('application/xml', response.content_type)
        self.assertIn(b'<loc>https://pomohaven.com/</loc>', response.data)
        self.assertIn(b'<changefreq>daily</changefreq>', response.data)
        self.assertIn(b'<priority>1.0</priority>', response.data)

    def test_user_register_and_login(self):
        """Test registering a new user account and subsequent login."""
        # 1. Register
        reg_payload = {
            "username": "scholar_jane",
            "email": "jane@study.edu",
            "password": "strongPassword123"
        }
        res_reg = self.client.post('/api/auth/register', data=json.dumps(reg_payload), content_type='application/json')
        self.assertEqual(res_reg.status_code, 201)
        data_reg = json.loads(res_reg.data)
        self.assertTrue(data_reg.get('success'))
        self.assertEqual(data_reg['user']['username'], 'scholar_jane')

        # 2. Check /api/auth/me
        res_me = self.client.get('/api/auth/me')
        self.assertEqual(res_me.status_code, 200)
        data_me = json.loads(res_me.data)
        self.assertTrue(data_me['authenticated'])
        self.assertEqual(data_me['user']['email'], 'jane@study.edu')

        # 3. Logout
        res_logout = self.client.post('/api/auth/logout')
        self.assertEqual(res_logout.status_code, 200)

        # 4. Check /api/auth/me after logout -> Guest
        res_guest = self.client.get('/api/auth/me')
        data_guest = json.loads(res_guest.data)
        self.assertFalse(data_guest['authenticated'])

        # 5. Login
        login_payload = {
            "login": "scholar_jane",
            "password": "strongPassword123"
        }
        res_login = self.client.post('/api/auth/login', data=json.dumps(login_payload), content_type='application/json')
        self.assertEqual(res_login.status_code, 200)
        data_login = json.loads(res_login.data)
        self.assertTrue(data_login.get('success'))

    def test_user_register_password_mismatch(self):
        """Test registration with mismatched confirm_password returns 400."""
        payload = {
            "username": "mismatch_user",
            "email": "mismatch@example.com",
            "password": "strongPassword123",
            "confirm_password": "differentPassword456"
        }
        res = self.client.post('/api/auth/register', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(res.status_code, 400)
        data = json.loads(res.data)
        self.assertFalse(data.get('success'))
        self.assertIn("Passwords do not match", data.get('error', ''))

    def test_user_register_with_matching_confirm_password(self):
        """Test registration with matching confirm_password succeeds."""
        payload = {
            "username": "match_user",
            "email": "match@example.com",
            "password": "strongPassword123",
            "confirm_password": "strongPassword123"
        }
        res = self.client.post('/api/auth/register', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(res.status_code, 201)
        data = json.loads(res.data)
        self.assertTrue(data.get('success'))

    def test_user_register_duplicate(self):
        """Test duplicate registration returns 409 Conflict."""
        payload = {
            "username": "dupe_user",
            "email": "dupe@example.com",
            "password": "password123"
        }
        self.client.post('/api/auth/register', data=json.dumps(payload), content_type='application/json')
        res_dupe = self.client.post('/api/auth/register', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(res_dupe.status_code, 409)

    def test_user_login_invalid_password(self):
        """Test login with wrong password returns 401 Unauthorized."""
        payload = {
            "username": "valid_user",
            "email": "valid@example.com",
            "password": "correctPassword"
        }
        self.client.post('/api/auth/register', data=json.dumps(payload), content_type='application/json')

        res_bad = self.client.post('/api/auth/login', data=json.dumps({
            "login": "valid_user",
            "password": "wrongPassword"
        }), content_type='application/json')
        self.assertEqual(res_bad.status_code, 401)

    def test_batch_sync_sessions(self):
        """Test batch syncing sessions from localStorage to user account."""
        # Register user
        self.client.post('/api/auth/register', data=json.dumps({
            "username": "syncer",
            "email": "sync@example.com",
            "password": "password123"
        }), content_type='application/json')

        # Batch sync 3 sessions
        now = datetime.now()
        local_sessions = [
            {
                "mode": "pomodoro",
                "duration_minutes": 25.0,
                "start_time": (now - timedelta(hours=2)).isoformat(),
                "status": "completed",
                "task_name": "Organic Chemistry"
            },
            {
                "mode": "short_break",
                "duration_minutes": 5.0,
                "start_time": (now - timedelta(hours=1)).isoformat(),
                "status": "completed",
                "task_name": "Tea break"
            }
        ]

        res_sync = self.client.post('/api/sessions/batch', data=json.dumps({
            "sessions": local_sessions
        }), content_type='application/json')
        self.assertEqual(res_sync.status_code, 200)
        data_sync = json.loads(res_sync.data)
        self.assertTrue(data_sync.get('success'))
        self.assertEqual(data_sync.get('synced_count'), 2)

        # Check user stats reflect synced sessions
        res_stats = self.client.get('/api/stats')
        data_stats = json.loads(res_stats.data)
        self.assertEqual(data_stats['stats']['total_focus_minutes'], 25.0)
        self.assertEqual(data_stats['stats']['completed_pomodoros'], 1)

    def test_record_session_valid(self):
        """Test recording a valid pomodoro study session."""
        now_utc = datetime.now(timezone.utc)
        payload = {
            "mode": "pomodoro",
            "duration_minutes": 25.0,
            "start_time": now_utc.isoformat(),
            "end_time": (now_utc + timedelta(minutes=25)).isoformat(),
            "status": "completed",
            "task_name": "Calculus Exam Prep"
        }
        response = self.client.post(
            '/api/sessions',
            data=json.dumps(payload),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 201)
        data = json.loads(response.data)
        self.assertTrue(data.get('success'))
        self.assertEqual(data['session']['mode'], 'pomodoro')
        self.assertEqual(data['session']['duration_minutes'], 25.0)
        self.assertEqual(data['session']['task_name'], 'Calculus Exam Prep')

    def test_record_session_invalid_mode(self):
        """Test recording with an invalid mode returns 400."""
        payload = {
            "mode": "invalid_mode_name",
            "duration_minutes": 25.0
        }
        response = self.client.post(
            '/api/sessions',
            data=json.dumps(payload),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertFalse(data.get('success'))

    def test_record_session_invalid_duration(self):
        """Test recording with a negative duration returns 400."""
        payload = {
            "mode": "pomodoro",
            "duration_minutes": -5.0
        }
        response = self.client.post(
            '/api/sessions',
            data=json.dumps(payload),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 400)

    def test_stats_calculation(self):
        """Test statistics aggregations (total hours, counts, weekly)."""
        now = datetime.now()

        # Insert 2 completed pomodoro sessions (25 min each)
        for i in range(2):
            self.client.post('/api/sessions', data=json.dumps({
                "mode": "pomodoro",
                "duration_minutes": 25.0,
                "start_time": now.isoformat(),
                "status": "completed",
                "task_name": f"Task {i+1}"
            }), content_type='application/json')

        # Insert 1 short break (5 min)
        self.client.post('/api/sessions', data=json.dumps({
            "mode": "short_break",
            "duration_minutes": 5.0,
            "start_time": now.isoformat(),
            "status": "completed"
        }), content_type='application/json')

        # Fetch stats
        response = self.client.get('/api/stats')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data.get('success'))

        stats = data['stats']
        self.assertEqual(stats['total_focus_minutes'], 50.0)
        self.assertEqual(stats['total_focus_hours'], 0.83)
        self.assertEqual(stats['completed_pomodoros'], 2)
        self.assertEqual(stats['total_sessions'], 3)
        self.assertEqual(stats['today_focus_minutes'], 50.0)
        self.assertEqual(stats['today_pomodoros'], 2)
        self.assertEqual(len(stats['weekly_activity']), 7)
        self.assertEqual(len(stats['recent_sessions']), 3)

    def test_work_mode_and_daily_streaks_persistence(self):
        """Test recording session with mode='work' persists to sessions and daily_streaks via /api/log-session."""
        # 1. Register a user
        reg_payload = {
            "username": "streak_master",
            "email": "streak@study.edu",
            "password": "strongPassword123"
        }
        res_reg = self.client.post('/api/auth/register', data=json.dumps(reg_payload), content_type='application/json')
        self.assertEqual(res_reg.status_code, 201)

        now = datetime.now(timezone.utc)
        start_time = now.isoformat()
        end_time = (now + timedelta(minutes=30)).isoformat()

        # 2. Record completed work session via /api/log-session alias
        payload = {
            "mode": "work",
            "duration_minutes": 30.0,
            "start_time": start_time,
            "end_time": end_time,
            "status": "completed",
            "task_name": "Deep Work on Project"
        }
        res_session = self.client.post('/api/log-session', data=json.dumps(payload), content_type='application/json')
        self.assertEqual(res_session.status_code, 201)
        data_session = json.loads(res_session.data)
        self.assertTrue(data_session.get('success'))
        self.assertEqual(data_session['session']['mode'], 'work')

        # 3. Verify statistics reflect the work session via /api/stats and /api/user-stats
        res_stats = self.client.get('/api/stats')
        self.assertEqual(res_stats.status_code, 200)
        data_stats = json.loads(res_stats.data)
        self.assertEqual(data_stats['stats']['total_focus_minutes'], 30.0)
        self.assertEqual(data_stats['stats']['completed_pomodoros'], 1)
        self.assertEqual(data_stats['stats']['current_streak_days'], 1)

        res_user_stats = self.client.get('/api/user-stats')
        self.assertEqual(res_user_stats.status_code, 200)
        data_user_stats = json.loads(res_user_stats.data)
        self.assertEqual(data_user_stats['stats']['total_focus_minutes'], 30.0)
        self.assertEqual(data_user_stats['stats']['completed_pomodoros'], 1)
        self.assertEqual(len(data_user_stats['stats']['weekly_activity']), 7)
        self.assertGreaterEqual(len(data_user_stats['stats']['recent_sessions']), 1)
        self.assertEqual(data_user_stats['stats']['recent_sessions'][0]['task_name'], 'Deep Work on Project')

        # 4. Verify daily_streaks table contains the updated streak record
        with flask_app.app.app_context():
            streak = flask_app.DailyStreak.query.filter_by(date=start_time[:10]).first()
            self.assertIsNotNone(streak)
            self.assertEqual(streak.pomodoro_count, 1)
            self.assertEqual(streak.total_minutes, 30.0)

    def test_get_and_save_preferences(self):
        """Test getting and saving user preferences."""
        prefs = {
            "theme": "cyberpunk",
            "pomodoro_duration": "30",
            "sound_type": "bell"
        }
        res_post = self.client.post(
            '/api/preferences',
            data=json.dumps(prefs),
            content_type='application/json'
        )
        self.assertEqual(res_post.status_code, 200)

        res_get = self.client.get('/api/preferences')
        self.assertEqual(res_get.status_code, 200)
        data = json.loads(res_get.data)
        self.assertTrue(data.get('success'))
        self.assertEqual(data['preferences']['theme'], 'cyberpunk')
        self.assertEqual(data['preferences']['pomodoro_duration'], '30')
        self.assertEqual(data['preferences']['sound_type'], 'bell')

    def test_clear_sessions(self):
        """Test clearing all logged sessions."""
        self.client.post('/api/sessions', data=json.dumps({
            "mode": "pomodoro",
            "duration_minutes": 25.0,
            "start_time": datetime.now(timezone.utc).isoformat(),
            "status": "completed"
        }), content_type='application/json')

        del_res = self.client.delete('/api/sessions')
        self.assertEqual(del_res.status_code, 200)

        get_res = self.client.get('/api/sessions')
        data = json.loads(get_res.data)
        self.assertEqual(data['count'], 0)

    def test_public_config_endpoint(self):
        """Test /api/config returns google_client_id."""
        response = self.client.get('/api/config')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertIn('google_client_id', data)

    def test_google_auth_missing_payload(self):
        """Test /api/auth/google without token returns 400."""
        response = self.client.post('/api/auth/google', data=json.dumps({}), content_type='application/json')
        self.assertEqual(response.status_code, 400)

    def test_google_auth_success(self):
        """Test successful Google OAuth token verification and login."""
        from unittest.mock import patch

        mock_idinfo = {
            "sub": "google-oauth-123456789",
            "email": "alex.student@gmail.com",
            "name": "Alex Rivera",
            "picture": "https://lh3.googleusercontent.com/a/mock-photo"
        }

        with patch('app.id_token.verify_oauth2_token', return_value=mock_idinfo):
            payload = {"credential": "mock-google-id-token-xyz"}
            response = self.client.post(
                '/api/auth/google',
                data=json.dumps(payload),
                content_type='application/json'
            )
            self.assertEqual(response.status_code, 200)
            data = json.loads(response.data)
            self.assertTrue(data.get('success'))
            self.assertEqual(data['user']['email'], 'alex.student@gmail.com')
            self.assertEqual(data['user']['name'], 'Alex Rivera')
            self.assertEqual(data['user']['avatar_url'], 'https://lh3.googleusercontent.com/a/mock-photo')
            self.assertEqual(data['user']['auth_provider'], 'google')

            # Verify session is active in /api/auth/me
            res_me = self.client.get('/api/auth/me')
            self.assertEqual(res_me.status_code, 200)
            data_me = json.loads(res_me.data)
            self.assertTrue(data_me['authenticated'])
            self.assertEqual(data_me['user']['email'], 'alex.student@gmail.com')

    def test_google_auth_direct_json(self):
        """Test Google authentication with direct JSON profile payload."""
        payload = {
            "email": "sam.scholar@gmail.com",
            "name": "Sam Scholar",
            "google_id": "google-sub-987654",
            "avatar_url": "https://lh3.googleusercontent.com/avatar.png"
        }
        response = self.client.post(
            '/api/auth/google',
            data=json.dumps(payload),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data.get('success'))
        self.assertEqual(data['user']['email'], 'sam.scholar@gmail.com')
        self.assertEqual(data['user']['name'], 'Sam Scholar')
        self.assertEqual(data['user']['avatar_url'], 'https://lh3.googleusercontent.com/avatar.png')
        first_id = data['id']

        # Update profile for same user
        update_payload = {
            "email": "sam.scholar@gmail.com",
            "name": "Sam Updated",
            "google_id": "google-sub-987654",
            "avatar_url": "https://lh3.googleusercontent.com/avatar2.png"
        }
        res2 = self.client.post('/api/auth/google', data=json.dumps(update_payload), content_type='application/json')
        data2 = json.loads(res2.data)
        self.assertEqual(data2['id'], first_id)
        self.assertEqual(data2['user']['name'], 'Sam Updated')

        # Different user
        other_payload = {
            "email": "other.scholar@gmail.com",
            "name": "Other Scholar",
            "google_id": "google-sub-555555"
        }
        res3 = self.client.post('/api/auth/google', data=json.dumps(other_payload), content_type='application/json')
        data3 = json.loads(res3.data)
        self.assertNotEqual(data3['id'], first_id)

    def test_record_session_with_user_id(self):
        """Test session recording attaches user_id to session record."""
        # 1. Login user
        payload = {
            "email": "timer.user@gmail.com",
            "name": "Timer User",
            "google_id": "google-sub-112233"
        }
        login_res = self.client.post('/api/auth/google', data=json.dumps(payload), content_type='application/json')
        login_data = json.loads(login_res.data)
        user_id = login_data.get('id') or (login_data.get('user') and login_data['user'].get('id'))

        # 2. Record completed pomodoro session
        session_res = self.client.post('/api/sessions', data=json.dumps({
            "mode": "pomodoro",
            "duration_minutes": 25.0,
            "start_time": datetime.now(timezone.utc).isoformat(),
            "end_time": datetime.now(timezone.utc).isoformat(),
            "status": "completed",
            "task_name": "CS Study"
        }), content_type='application/json')

        self.assertEqual(session_res.status_code, 201)
        session_data = json.loads(session_res.data)
        self.assertTrue(session_data['success'])
        self.assertEqual(session_data['session']['user_id'], user_id)
        self.assertEqual(session_data['session']['task_name'], 'CS Study')

    def test_weekly_stats_endpoint(self):
        """Test /api/stats/weekly returns 7 days breakdown and total_weekly_hours."""
        now = datetime.now()
        self.client.post('/api/sessions', data=json.dumps({
            "mode": "pomodoro",
            "duration_minutes": 50.0,
            "start_time": now.isoformat(),
            "end_time": now.isoformat(),
            "status": "completed"
        }), content_type='application/json')

        response = self.client.get('/api/stats/weekly')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data.get('success'))
        self.assertEqual(len(data['days']), 7)
        self.assertEqual(len(data['minutes']), 7)
        self.assertGreaterEqual(data['total_weekly_hours'], 0.8)

    def test_recent_sessions_endpoint(self):
        """Test /api/sessions/recent returns 5 most recent sessions."""
        now = datetime.now()
        for i in range(6):
            self.client.post('/api/sessions', data=json.dumps({
                "mode": "pomodoro",
                "duration_minutes": 25.0,
                "start_time": (now + timedelta(minutes=i*30)).isoformat(),
                "end_time": (now + timedelta(minutes=i*30 + 25)).isoformat(),
                "status": "completed",
                "task_name": f"Session {i+1}"
            }), content_type='application/json')

        response = self.client.get('/api/sessions/recent')
        self.assertEqual(response.status_code, 200)
        sessions = json.loads(response.data)
        self.assertIsInstance(sessions, list)
        self.assertEqual(len(sessions), 5)
        self.assertIn('task_title', sessions[0])
        self.assertIn('completed_at', sessions[0])

    def test_submit_feedback_endpoint(self):
        """Test /api/feedback saves feedback successfully, validates types, and truncates to 1000 chars."""
        res = self.client.post('/api/feedback', data=json.dumps({
            "feedback_type": "Feature Request",
            "message": "Love the app! Please add ambient rain sounds.",
            "email": "scholar@pomohaven.com"
        }), content_type='application/json')

        self.assertEqual(res.status_code, 200)
        data = json.loads(res.data)
        self.assertTrue(data['success'])
        self.assertIn("Feedback received!", data['message'])

        # Form Data submission test
        form_res = self.client.post('/api/feedback', data={
            "feedback_type": "Bug Report",
            "message": "Timer pause button feels unresponsive on mobile.",
            "email": "mobile@pomohaven.com"
        })
        self.assertEqual(form_res.status_code, 200)
        form_data = json.loads(form_res.data)
        self.assertTrue(form_data['success'])

        # Empty message validation
        err_res = self.client.post('/api/feedback', data=json.dumps({
            "message": "   "
        }), content_type='application/json')
        self.assertEqual(err_res.status_code, 400)

        # Non-string message type validation
        err_type_res = self.client.post('/api/feedback', data=json.dumps({
            "message": 12345
        }), content_type='application/json')
        self.assertEqual(err_type_res.status_code, 400)

        # Message truncation > 1000 chars test
        long_message = "A" * 1500
        trunc_res = self.client.post('/api/feedback', data=json.dumps({
            "message": long_message
        }), content_type='application/json')
        self.assertEqual(trunc_res.status_code, 200)

        # Verify truncated message in database
        with flask_app.app.app_context():
            latest_fb = flask_app.Feedback.query.order_by(flask_app.Feedback.id.desc()).first()
            self.assertIsNotNone(latest_fb)
            self.assertEqual(len(latest_fb.message), 1000)

    def test_security_cookie_configuration(self):
        """Test session cookie security attributes."""
        self.assertTrue(flask_app.app.config.get('SESSION_COOKIE_HTTPONLY'))
        self.assertEqual(flask_app.app.config.get('SESSION_COOKIE_SAMESITE'), 'Lax')


    def test_multi_user_data_isolation(self):
        """Test multiple users on separate clients do not share or overwrite data."""
        client_a = flask_app.app.test_client()
        client_b = flask_app.app.test_client()

        # 1. Login User A
        res_a = client_a.post('/api/auth/google', data=json.dumps({
            "email": "user.a@pomohaven.com",
            "name": "User Alpha",
            "google_id": "google-sub-alpha-111"
        }), content_type='application/json')
        self.assertEqual(res_a.status_code, 200)

        # Record session for User A
        client_a.post('/api/sessions', data=json.dumps({
            "mode": "pomodoro",
            "duration_minutes": 50.0,
            "start_time": datetime.now(timezone.utc).isoformat(),
            "end_time": datetime.now(timezone.utc).isoformat(),
            "status": "completed",
            "task_name": "Alpha Focus"
        }), content_type='application/json')

        # 2. Login User B
        res_b = client_b.post('/api/auth/google', data=json.dumps({
            "email": "user.b@pomohaven.com",
            "name": "User Beta",
            "google_id": "google-sub-beta-222"
        }), content_type='application/json')
        self.assertEqual(res_b.status_code, 200)

        # Check User B profile
        res_me_b = client_b.get('/api/user/me')
        data_me_b = json.loads(res_me_b.data)
        self.assertTrue(data_me_b['authenticated'])
        self.assertEqual(data_me_b['user']['email'], "user.b@pomohaven.com")

        # Verify User B does not see User A's session
        res_sessions_b = client_b.get('/api/sessions')
        data_sessions_b = json.loads(res_sessions_b.data)
        self.assertEqual(data_sessions_b['count'], 0)

        # Record session for User B
        client_b.post('/api/sessions', data=json.dumps({
            "mode": "pomodoro",
            "duration_minutes": 25.0,
            "start_time": datetime.now(timezone.utc).isoformat(),
            "end_time": datetime.now(timezone.utc).isoformat(),
            "status": "completed",
            "task_name": "Beta Focus"
        }), content_type='application/json')

        # User A checks sessions -> only Alpha Focus (1 session)
        res_sessions_a = client_a.get('/api/sessions')
        data_sessions_a = json.loads(res_sessions_a.data)
        self.assertEqual(data_sessions_a['count'], 1)
        self.assertEqual(data_sessions_a['sessions'][0]['task_name'], "Alpha Focus")


if __name__ == '__main__':
    unittest.main()
