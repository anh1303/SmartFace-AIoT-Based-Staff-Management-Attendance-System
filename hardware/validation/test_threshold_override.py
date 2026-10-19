"""Validate real .env threshold precedence in fresh, isolated config imports."""
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]


class ThresholdOverrideTests(unittest.TestCase):
    def load(self, folder, profile='FULL', probability='', logit='', predictor=False):
        base = ROOT / folder
        models = base / ('models' if folder == 'hardware' else 'antispoof/models')
        contract = models / f'R7_SC_{profile}_crop15_runtime_config_casia.json'
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp)
            shutil.copyfile(base / 'config.py', path / 'config.py')
            (path / '.env').write_text(f'PAD_RUNTIME_CONFIG_PATH={contract}\nPAD_THRESHOLD={probability}\nPAD_THRESHOLD_LOGIT={logit}\n')
            env = os.environ.copy()
            for key in ('PAD_RUNTIME_CONFIG_PATH', 'PAD_THRESHOLD', 'PAD_THRESHOLD_LOGIT'):
                env.pop(key, None)
            code = '''import config,json
print(json.dumps(dict(probability=config.PAD_THRESHOLD,logit=config.PAD_THRESHOLD_LOGIT,
                      source=config.PAD_THRESHOLD_SOURCE,model=config.PAD_MODEL_FILENAME)))'''
            if predictor:
                code = f'''import config,sys,json,numpy as np
sys.path.insert(0, {str(base)!r})
from antispoof.predictor import AntiSpoofPredictor
pad=AntiSpoofPredictor()
print(json.dumps(dict(logit=pad.logit_threshold,probability=pad.threshold_probability,
                      real_above=pad.process_with_logits(np.array([.1,0.]))['is_real'],
                      real_below=pad.process_with_logits(np.array([-.1,0.]))['is_real'])))'''
            return subprocess.run([sys.executable, '-c', code], cwd=path, env=env, capture_output=True, text=True)

    def read(self, result):
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(result.stdout.splitlines()[-1])

    def test_blank_or_whitespace_uses_the_selected_model_json(self):
        for folder in ('hardware', 'face_auth'):
            for profile, threshold in (('FULL', 1.6586914), ('100K', -4.2998047)):
                with self.subTest(folder=folder, profile=profile):
                    value = self.read(self.load(folder, profile, '   ', '   '))
                    self.assertAlmostEqual(value['logit'], threshold)
                    self.assertEqual(value['source'], 'runtime_json')
                    self.assertEqual(value['model'], f'R7_SC_{profile}_crop15.onnx')

    def test_logit_override_including_zero_takes_precedence_over_json(self):
        for folder in ('hardware', 'face_auth'):
            for profile in ('FULL', '100K'):
                for threshold in (0, -2, 2):
                    with self.subTest(folder=folder, profile=profile, threshold=threshold):
                        value = self.read(self.load(folder, profile, logit=str(threshold)))
                        self.assertEqual(value['logit'], threshold)
                        self.assertAlmostEqual(value['probability'], 1/(1+math.exp(-threshold)))
                        self.assertEqual(value['source'], 'env:PAD_THRESHOLD_LOGIT')

    def test_probability_override_derives_logit(self):
        for folder in ('hardware', 'face_auth'):
            for profile in ('FULL', '100K'):
                value = self.read(self.load(folder, profile, probability='.8'))
                self.assertAlmostEqual(value['probability'], .8)
                self.assertAlmostEqual(value['logit'], math.log(4))
                self.assertEqual(value['source'], 'env:PAD_THRESHOLD')

    def test_two_overrides_must_be_consistent(self):
        for folder in ('hardware', 'face_auth'):
            value = self.read(self.load(folder, probability='.8', logit=str(math.log(4))))
            self.assertEqual(value['source'], 'env:PAD_THRESHOLD+PAD_THRESHOLD_LOGIT')
            bad = self.load(folder, probability='.8', logit='0')
            self.assertNotEqual(bad.returncode, 0)
            self.assertIn('không nhất quán', bad.stderr)

    def test_invalid_manual_values_fail_instead_of_silently_using_json(self):
        for folder in ('hardware', 'face_auth'):
            for key, values in (('probability', ('bad','nan','inf','0','1','-1')), ('logit', ('bad','nan','inf','-inf'))):
                for value in values:
                    with self.subTest(folder=folder, key=key, value=value):
                        result = self.load(folder, **{key:value})
                        self.assertNotEqual(result.returncode, 0)
                        self.assertIn('ValueError', result.stderr)

    def test_actual_predictor_respects_zero_override_on_both_sides(self):
        for folder in ('hardware', 'face_auth'):
            value = self.read(self.load(folder, logit='0', predictor=True))
            self.assertEqual(value['logit'], 0)
            self.assertEqual(value['probability'], .5)
            self.assertTrue(value['real_above'])
            self.assertFalse(value['real_below'])


if __name__ == '__main__':
    unittest.main()
