import base64
import json
from pathlib import Path
import sys
import tempfile
import unittest

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from backfill_avatar_thumbnails import prepare_avatar, save_backup, guarded_update


class AvatarBackfillTests(unittest.TestCase):
    def test_only_large_valid_inline_images_are_recompressed(self):
        image = np.random.default_rng(12).integers(0, 256, (700, 1000, 3), dtype=np.uint8)
        _, encoded = cv2.imencode('.png', image)
        raw = base64.b64encode(encoded).decode('ascii')
        for original in [raw, 'data:image/png;base64,' + raw]:
            thumbnail = prepare_avatar(original)
            self.assertLessEqual(len(thumbnail.encode()), 40 * 1024)
            self.assertIsNotNone(cv2.imdecode(np.frombuffer(base64.b64decode(thumbnail.split(',')[1]), np.uint8), cv2.IMREAD_COLOR))
        for original in [None, '', 'https://example.com/picture.jpg', 'data:image/png;base64,small']:
            self.assertIsNone(prepare_avatar(original))
        with self.assertRaises(ValueError):
            prepare_avatar('data:image/png;base64,' + '?' * 50000)

    def test_backup_is_verified_and_keeps_original_values_and_planned_replacements(self):
        rows = [{'id': 'e', 'avatar_url': 'original', 'updated_at': None}]
        with tempfile.TemporaryDirectory() as directory:
            path = save_backup(Path(directory), rows, {'e': 'new'})
            backup = json.loads(path.read_text(encoding='utf-8'))
            self.assertEqual(backup['rows'], rows)
            self.assertEqual(backup['replacements'], {'e': 'new'})
            self.assertTrue(path.with_suffix('.sha256').is_file())

    def test_update_compares_current_avatar_and_never_overwrites_concurrent_change(self):
        class Connection:
            def execute(self, sql, params):
                self.sql, self.params = sql, params
                return self
            def fetchone(self):
                return None
        conn = Connection()
        self.assertFalse(guarded_update(conn, 'e', 'old', 'new'))
        self.assertIn('avatar_url IS NOT DISTINCT FROM', conn.sql)
        self.assertEqual(conn.params, ('new', 'e', 'old'))


if __name__ == '__main__':
    unittest.main()
