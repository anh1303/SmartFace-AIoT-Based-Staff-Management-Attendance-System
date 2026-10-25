"""Import configs in isolated processes; never open camera/GPIO/database."""
import json
import os
from pathlib import Path
import subprocess
import sys
import unittest
ROOT=Path(__file__).resolve().parents[2]


class AdaptiveConfigTests(unittest.TestCase):
    def read_config(self,folder,**overrides):
        env=os.environ.copy()
        env.update(PAD_RUNTIME_CONFIG_PATH=('antispoof/models/' if folder=='face_auth' else 'models/')+'R7_SC_FULL_crop15_runtime_config_casia.json',
                   PAD_ADAPTIVE_CONFIG_PATH=('antispoof/models/' if folder=='face_auth' else 'models/')+'R7_SC_FULL_local80_candidate_runtime.json',
                   PAD_ADAPTIVE_ENABLED='false',PAD_THRESHOLD='',PAD_THRESHOLD_LOGIT='',PAD_BBOX_EXPANSION_FACTOR='',FORCE_GAMMA='false')
        env.update(overrides)
        code='import config,json;print(json.dumps({k:getattr(config,k) for k in '+repr(('PAD_ADAPTIVE_ENABLED','PAD_THRESHOLD_LOGIT','PAD_THRESHOLD_SOURCE','PAD_BBOX_EXPANSION_FACTOR','FORCE_GAMMA','PAD_GAMMA_ENABLED','PAD_LIGHTING_PROFILE','PAD_ADAPTIVE_THRESHOLD_PROFILE'))+'}))'
        result=subprocess.run([sys.executable,'-c',code],cwd=ROOT/folder,env=env,text=True,capture_output=True)
        return result

    def test_enabled_profile_beats_conflicting_env_in_both_runtimes(self):
        for folder in ('face_auth','hardware'):
            with self.subTest(folder=folder):
                result=self.read_config(folder,PAD_ADAPTIVE_ENABLED='true',PAD_THRESHOLD='garbage',PAD_THRESHOLD_LOGIT='999',
                                        PAD_BBOX_EXPANSION_FACTOR='invalid',FORCE_GAMMA='true',PAD_RUNTIME_CONFIG_PATH='/missing/base.json')
                self.assertEqual(result.returncode,0,result.stderr)
                cfg=json.loads(result.stdout)
                self.assertTrue(cfg['PAD_ADAPTIVE_ENABLED'])
                self.assertAlmostEqual(cfg['PAD_THRESHOLD_LOGIT'],-1.315033942317963)
                self.assertEqual(cfg['PAD_THRESHOLD_SOURCE'],'adaptive_profile')
                self.assertEqual(cfg['PAD_BBOX_EXPANSION_FACTOR'],1.45)
                self.assertFalse(cfg['FORCE_GAMMA']);self.assertFalse(cfg['PAD_GAMMA_ENABLED'])
                self.assertEqual(cfg['PAD_LIGHTING_PROFILE'],{'method':'gamma','gamma':.4})

    def test_local98_profile_beats_manual_env_in_both_runtimes(self):
        for folder in ('face_auth', 'hardware'):
            prefix = 'antispoof/models/' if folder == 'face_auth' else 'models/'
            result = self.read_config(folder, PAD_ADAPTIVE_ENABLED='true',
                                     PAD_ADAPTIVE_CONFIG_PATH=prefix+'R7_SC_FULL_local98_shadow_runtime.json',
                                     PAD_THRESHOLD_LOGIT='999', PAD_BBOX_EXPANSION_FACTOR='2', FORCE_GAMMA='true')
            self.assertEqual(result.returncode, 0, result.stderr)
            cfg = json.loads(result.stdout)
            self.assertAlmostEqual(cfg['PAD_THRESHOLD_LOGIT'], -2.809873753070831)
            self.assertEqual(cfg['PAD_BBOX_EXPANSION_FACTOR'], 1.45)
            self.assertFalse(cfg['PAD_GAMMA_ENABLED'])
            self.assertEqual(cfg['PAD_LIGHTING_PROFILE']['method'], 'shadow_gamma')
            self.assertEqual(cfg['PAD_ADAPTIVE_THRESHOLD_PROFILE']['method'], 'face_background')

    def test_final_pi_color_profile_has_priority_and_portable_models(self):
        for folder in ('face_auth', 'hardware'):
            prefix = 'antispoof/models/' if folder == 'face_auth' else 'models/'
            for name, crop in (('pi_final_conservative', 1.7), ('pi_final_balanced', 2.2),
                               ('pi_final_common', 1.2), ('pi_all1136_strict', 1.2),
                               ('pi_all1136_balanced', 1.1), ('pi_all1136_real', 1.2)):
                result = self.read_config(folder, PAD_ADAPTIVE_ENABLED='true',
                                         PAD_ADAPTIVE_CONFIG_PATH=prefix+'R7_SC_FULL_'+name+'_runtime.json',
                                         PAD_THRESHOLD_LOGIT='999', PAD_BBOX_EXPANSION_FACTOR='999', FORCE_GAMMA='true')
                self.assertEqual(result.returncode, 0, result.stderr)
                cfg = json.loads(result.stdout)
                self.assertEqual(cfg['PAD_THRESHOLD_SOURCE'], 'adaptive_profile')
                self.assertEqual(cfg['PAD_BBOX_EXPANSION_FACTOR'], crop)
                self.assertFalse(cfg['PAD_GAMMA_ENABLED'])
                self.assertEqual(cfg['PAD_ADAPTIVE_THRESHOLD_PROFILE']['method'], 'raw_color')
                self.assertNotEqual(cfg['PAD_THRESHOLD_LOGIT'], 999.)

    def test_disabled_preserves_env_override_then_json_fallback(self):
        for folder in ('face_auth','hardware'):
            for override in (False,True):
                result=self.read_config(folder,**({'PAD_THRESHOLD_LOGIT':'0.25','PAD_BBOX_EXPANSION_FACTOR':'1.2'} if override else {}))
                self.assertEqual(result.returncode,0,result.stderr)
                cfg=json.loads(result.stdout)
                self.assertAlmostEqual(cfg['PAD_THRESHOLD_LOGIT'],.25 if override else 1.6586914)
                self.assertEqual(cfg['PAD_BBOX_EXPANSION_FACTOR'],1.2 if override else 1.5)
                self.assertIsNone(cfg['PAD_ADAPTIVE_THRESHOLD_PROFILE'])

    def test_bad_enabled_profile_fails_without_silent_fallback(self):
        for folder in ('face_auth','hardware'):
            prefix='antispoof/models/' if folder=='face_auth' else 'models/'
            for path in ('None','/missing/adaptive.json',prefix+'R7_SC_FULL_crop15_runtime_config_casia.json'):
                result=self.read_config(folder,PAD_ADAPTIVE_ENABLED='true',PAD_ADAPTIVE_CONFIG_PATH=path)
                self.assertNotEqual(result.returncode,0)
