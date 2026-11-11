import base64
import unittest
from unittest.mock import patch

import cv2
import numpy as np
from enrollment.avatar import make_avatar_thumbnail, enrollment_avatar


class AvatarThumbnailTests(unittest.TestCase):
    def test_size_aspect_ratio_byte_budget_and_original_image_are_preserved(self):
        for height, width in [(1200, 1800), (1800, 1200), (60, 100), (320, 320)]:
            with self.subTest(shape=(height, width)):
                image = np.random.default_rng(7).integers(0, 256, (height, width, 3), dtype=np.uint8)
                original = image.copy()
                uri = make_avatar_thumbnail(image)
                self.assertTrue(uri.startswith('data:image/jpeg;base64,'))
                self.assertLessEqual(len(uri.encode('utf-8')), 40 * 1024)
                decoded = cv2.imdecode(np.frombuffer(base64.b64decode(uri.split(',')[1], validate=True), dtype=np.uint8), cv2.IMREAD_COLOR)
                self.assertIsNotNone(decoded)
                h, w = decoded.shape[:2]
                self.assertLessEqual(max(h, w), min(320, max(height, width)))
                self.assertAlmostEqual(w / h, width / height, delta=0.02)
                np.testing.assert_array_equal(image, original)

    def test_encoding_failure_skips_avatar_without_falling_back_to_original_blob(self):
        with patch('enrollment.avatar.cv2.imencode', return_value=(False, None)):
            with self.assertLogs('enrollment.avatar', level='WARNING'):
                self.assertIsNone(enrollment_avatar(np.zeros((10, 10, 3), np.uint8)))

    def test_no_valid_avatar_does_not_create_an_image(self):
        self.assertIsNone(enrollment_avatar(None))


if __name__ == '__main__':
    unittest.main()
