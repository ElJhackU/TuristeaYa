import os
import unittest
from types import SimpleNamespace
from uuid import UUID

os.environ['SUPABASE_URL'] = 'https://test.supabase.co'
os.environ['SUPABASE_KEY'] = 'sb_publishable_test'

import httpx
from fastapi.testclient import TestClient
from postgrest import SyncPostgrestClient
from app.db.client import get_authenticated_supabase, get_required_authenticated_supabase
from app.core.config import Settings
from main import app

USER = '00000000-0000-4000-8000-000000000001'
RECORD = '00000000-0000-4000-8000-000000000002'


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.calls = []
        self.empty = False
        self.role = None
        def handle(request):
            self.calls.append(request)
            if request.url.path.endswith('/user_access'):
                if request.url.params.get('select') == 'user_id':
                    return httpx.Response(200, json=[{'id': RECORD, 'user_id': USER}])
                if 'application/vnd.pgrst.object' in request.headers.get('accept', ''):
                    return httpx.Response(200, json={'id': RECORD, 'user_id': USER})
                return httpx.Response(200, json=[{'role': self.role}] if self.role else [])
            if request.method == 'GET' and 'application/vnd.pgrst.object' in request.headers.get('accept', ''):
                return httpx.Response(200, json={'id': RECORD})
            return httpx.Response(200, json=[] if self.empty else [{'id': RECORD, 'user_id': USER}])
        self.http = httpx.Client(transport=httpx.MockTransport(handle))
        self.pg = SyncPostgrestClient('https://test.invalid/rest/v1', http_client=self.http)
        self.db = SimpleNamespace(table=self.pg.table, auth=SimpleNamespace(get_user=lambda token: SimpleNamespace(user=SimpleNamespace(id=USER))))
        app.dependency_overrides[get_authenticated_supabase] = lambda: self.db
        app.dependency_overrides[get_required_authenticated_supabase] = lambda: self.db
        self.client = TestClient(app)
        self.headers = {'Authorization': 'Bearer test'}

    def tearDown(self):
        app.dependency_overrides.clear()
        self.client.close()
        self.http.close()

    def test_private_reads_require_session(self):
        for table in ['profiles', 'notifications', 'tickets', 'user-access', 'reservations']:
            self.assertEqual(self.client.get('/api/v1/' + table).status_code, 401, table)

    def test_read_scope_and_stable_order(self):
        result = self.client.get('/api/v1/notifications', headers=self.headers)
        self.assertEqual(result.status_code, 200)
        self.assertEqual(self.calls[-1].url.params['user_id'], 'eq.' + USER)
        self.assertEqual(self.calls[-1].url.params['order'], 'id.asc')

    def test_profiles_use_id_not_user_id(self):
        self.assertEqual(self.client.get('/api/v1/profiles', headers=self.headers).status_code, 200)
        self.assertEqual(self.calls[-1].url.params['id'], 'eq.' + USER)

    def test_schema_filters_and_payloads(self):
        self.assertEqual(self.client.get('/api/v1/categories?place_id=' + RECORD).status_code, 422)
        self.assertEqual(self.client.post('/api/v1/reviews', headers=self.headers, json={'typo': 1}).status_code, 422)
        self.assertEqual(self.client.post('/api/v1/reviews', headers=self.headers, json={'created_at': 'today'}).status_code, 422)

    def test_review_ownership_and_moderation(self):
        self.assertEqual(self.client.post('/api/v1/reviews', headers=self.headers, json={'user_id': RECORD, 'body': 'x'}).status_code, 403)
        self.assertEqual(self.client.patch('/api/v1/reviews/' + RECORD, headers=self.headers, json={'hidden': False}).status_code, 403)

    def test_sdk_insert_update_delete(self):
        result = self.client.post('/api/v1/reviews', headers=self.headers, json={'place_id': RECORD, 'rating': 5, 'body': 'Prueba'})
        self.assertEqual(result.status_code, 201, result.text)
        result = self.client.patch('/api/v1/reviews/' + RECORD, headers=self.headers, json={'body': 'Actualizado'})
        self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual(self.calls[-1].url.params['user_id'], 'eq.' + USER)
        result = self.client.delete('/api/v1/reviews/' + RECORD, headers=self.headers)
        self.assertEqual(result.status_code, 204, result.text)

    def test_empty_update_is_not_found(self):
        self.empty = True
        self.assertEqual(self.client.patch('/api/v1/reviews/' + RECORD, headers=self.headers, json={'body': 'x'}).status_code, 404)

    def test_notifications_cannot_be_reassigned(self):
        result = self.client.patch('/api/v1/notifications/' + RECORD, headers=self.headers, json={'user_id': RECORD})
        self.assertEqual(result.status_code, 403)

    def test_secret_key_rejected(self):
        with self.assertRaises(ValueError):
            Settings(SUPABASE_URL='https://test.supabase.co', SUPABASE_KEY='sb_secret_test', _env_file=None)

    def test_support_can_resolve_cases_without_claiming_ownership(self):
        self.role = 'support'
        result = self.client.patch('/api/v1/tickets/' + RECORD, headers=self.headers, json={'status': 'resolved'})
        self.assertEqual(result.status_code, 200, result.text)
        self.assertNotIn('user_id', self.calls[-1].url.params)

    def test_tourist_cannot_resolve_or_assign_cases(self):
        self.role = 'tourist'
        result = self.client.patch('/api/v1/tickets/' + RECORD, headers=self.headers, json={'status': 'resolved'})
        self.assertEqual(result.status_code, 403)

    def test_admin_can_moderate_but_not_change_own_access(self):
        self.role = 'admin'
        result = self.client.patch('/api/v1/reviews/' + RECORD, headers=self.headers, json={'hidden': True})
        self.assertEqual(result.status_code, 200, result.text)
        result = self.client.patch('/api/v1/user-access/' + RECORD, headers=self.headers, json={'role': 'tourist'})
        self.assertEqual(result.status_code, 403)

    def test_business_update_is_scoped_to_owner(self):
        self.role = 'advertiser'
        result = self.client.patch('/api/v1/businesses/' + RECORD, headers=self.headers, json={'name': 'Actualizado'})
        self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual(self.calls[-1].url.params['owner_id'], 'eq.' + USER)


if __name__ == '__main__':
    unittest.main()
