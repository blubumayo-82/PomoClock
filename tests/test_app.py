"""
Unit and Integration Tests for PomoClock Flask Backend & Authentication
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
            flask_app.init_db()

    def tearDown(self):
        # Clean up temporary database
        os.close(self.db_fd)
        if os.path.exists(self.temp_db_path):
            os.unlink(self.temp_db_path)

    def test_health_check(self):
        """Test health check endpoint."""
        response = self.client.get('/api/health')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data.get('status'), 'healthy')
        self.assertTrue(data.get('guest_mode'))

    def test_index_page(self):
        """Test index page returns HTML with 200 OK and PomoClock branding."""
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'PomoClock', response.data)
        self.assertIn(b'Study & Deep Work', response.data)

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


if __name__ == '__main__':
    unittest.main()
