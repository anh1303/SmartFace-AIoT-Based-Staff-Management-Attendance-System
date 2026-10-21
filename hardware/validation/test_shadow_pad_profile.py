"""Production profile parity, raw-input thresholds and calibration transform contract."""
import importlib.util
import json
from pathlib import Path
import unittest
import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[2]


class ShadowProfileTests(unittest.TestCase):
    def test_both_runtimes_match_reference_without_mutating_input(self):
        profiles = []
        for folder, modeldir in (('face_auth', 'antispoof/models'), ('hardware', 'models')):
            profile = json.loads((ROOT / folder / modeldir / 'R7_SC_FULL_local98_shadow_runtime.json').read_text())
            profiles.append(profile)
            spec = importlib.util.spec_from_file_location('lighting_' + folder, ROOT / folder / 'antispoof/lighting.py')
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            transform = module.LightingTransform(profile['lighting'])
            adapter = module.BrightnessThreshold(profile['adaptive_threshold'])
            rng = np.random.default_rng(52)
            for full_level, center_level in ((30, 120), (120, 30), (90, 90)):
                image = np.full((80, 80, 3), full_level, np.uint8)
                image[16:64, 16:64] = center_level
                image = cv2.add(image, rng.integers(0, 12, image.shape, dtype=np.uint8))
                before = image.copy()
                y = cv2.cvtColor(image, cv2.COLOR_BGR2YCrCb)[:, :, 0]
                full, center = float(y.mean()), float(y[16:64, 16:64].mean())
                gamma = round(.4 + (.55 - .4) * float(np.clip((full-center+5)/10, 0, 1)), 2)
                filtered = cv2.addWeighted(image, .5, cv2.GaussianBlur(image, (3, 3), .6), .5, 0)
                lut = np.clip((np.arange(256)/255.)**gamma*255., 0, 255).astype(np.uint8)
                np.testing.assert_array_equal(transform(image), cv2.LUT(filtered, lut))
                base = profile['calibrated_logit_threshold']
                self.assertAlmostEqual(adapter(image, base), base + float(np.clip(3*(center-120)/50 + 3*(center-full)/40, -3, 3)))
                np.testing.assert_array_equal(image, before)
            invalid = dict(profile['lighting'], transition_high=-5.)
            with self.assertRaises(ValueError):
                module.LightingTransform(invalid)
            invalid = dict(profile['adaptive_threshold'], gap_scale=0.)
            with self.assertRaises(ValueError):
                module.BrightnessThreshold(invalid)
        self.assertEqual(profiles[0], profiles[1])
