"""White-balance gamma parity and contract checks without camera or research scripts."""
import importlib.util
from pathlib import Path
import unittest
import cv2
import numpy as np
ROOT=Path(__file__).resolve().parents[2]


class WhiteBalancePADTests(unittest.TestCase):
    def test_exact_reference_and_input_preservation_in_both_runtimes(self):
        for folder in ('face_auth','hardware'):
            spec=importlib.util.spec_from_file_location('wb_'+folder,ROOT/folder/'antispoof/lighting.py')
            module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
            rng=np.random.default_rng(20261021)
            for blend in (0.,.5,1.):
                profile=dict(method='wb_gamma',gamma=1.15,blend=blend,min_gain=.7,max_gain=1.3)
                transform=module.LightingTransform(profile)
                for image in (rng.integers(0,256,(80,80,3),dtype=np.uint8),np.zeros((80,80,3),np.uint8),np.full((80,80,3),(220,80,10),np.uint8)):
                    before=image.copy();means=image.reshape(-1,3).mean(axis=0)
                    gain=np.clip(means.mean()/np.maximum(means,1.),.7,1.3);gain=1+blend*(gain-1)
                    corrected=np.clip(image.astype(np.float32)*gain,0,255).astype(np.uint8)
                    lut=np.clip((np.arange(256)/255.)**1.15*255,0,255).astype(np.uint8)
                    expected=cv2.LUT(corrected,lut)
                    np.testing.assert_array_equal(transform(image),expected)
                    np.testing.assert_array_equal(transform(image),expected)
                    np.testing.assert_array_equal(image,before)
            for profile in (dict(method='wb_gamma',gamma=0),dict(method='wb_gamma',gamma=1,min_gain=2,max_gain=1),dict(method='wb_gamma',gamma=float('nan'))):
                with self.assertRaises(ValueError):module.LightingTransform(profile)

    def test_exposure_gamma_uses_each_balanced_crop_and_stays_bounded(self):
        import math
        for folder in ('face_auth', 'hardware'):
            spec = importlib.util.spec_from_file_location('exposure_'+folder, ROOT/folder/'antispoof/lighting.py')
            module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
            profile = dict(method='wb_exposure_gamma', target=95., blend=1., min_gain=.7, max_gain=1.3, min_gamma=.7, max_gamma=1.5)
            transform = module.LightingTransform(profile)
            for color in ((0, 0, 0), (255, 255, 255), (200, 80, 30), (15, 30, 40)):
                image = np.full((80,80,3), color, np.uint8); before = image.copy()
                means = image.reshape(-1,3).mean(axis=0)
                gains = np.clip(means.mean()/np.maximum(means,1.), .7, 1.3)
                balanced = np.clip(image.astype(np.float32)*gains, 0, 255).astype(np.uint8)
                y = cv2.cvtColor(balanced, cv2.COLOR_BGR2YCrCb)[:,:,0]
                gamma = round(float(np.clip(math.log(95./255.) / math.log(float(np.clip(y[16:64,16:64].mean(),1.,254.))/255.),.7,1.5)),2)
                lut = np.clip((np.arange(256)/255.)**gamma*255.,0,255).astype(np.uint8)
                np.testing.assert_array_equal(transform(image), cv2.LUT(balanced,lut))
                np.testing.assert_array_equal(image,before)
            for change in (dict(target=0), dict(max_gamma=5), dict(min_gamma=2,max_gamma=1)):
                with self.assertRaises(ValueError): module.LightingTransform(dict(profile, **change))
