"""
Unit and Integration Tests for Pomodoro Study Timer Flask Backend
"""

import os
import json
import unittest
import tempfile
from datetime import datetime, timedelta, timezone

# Set temporary test database environment
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

    def test_index_page(self):
        """Test index page returns HTML with 200 OK."""
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'PomoClock', response.data)
        self.assertIn(b'Pomodoro Study Timer', response.data)

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
        # Save preferences
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

        # Get preferences
        res_get = self.client.get('/api/preferences')
        self.assertEqual(res_get.status_code, 200)
        data = json.loads(res_get.data)
        self.assertTrue(data.get('success'))
        self.assertEqual(data['preferences']['theme'], 'cyberpunk')
        self.assertEqual(data['preferences']['pomodoro_duration'], '30')
        self.assertEqual(data['preferences']['sound_type'], 'bell')

    def test_clear_sessions(self):
        """Test clearing all logged sessions."""
        # Add a session
        self.client.post('/api/sessions', data=json.dumps({
            "mode": "pomodoro",
            "duration_minutes": 25.0,
            "start_time": datetime.now(timezone.utc).isoformat(),
            "status": "completed"
        }), content_type='application/json')

        # Clear
        del_res = self.client.delete('/api/sessions')
        self.assertEqual(del_res.status_code, 200)

        # Check count is 0
        get_res = self.client.get('/api/sessions')
        data = json.loads(get_res.data)
        self.assertEqual(data['count'], 0)


if __name__ == '__main__':
    unittest.main()
