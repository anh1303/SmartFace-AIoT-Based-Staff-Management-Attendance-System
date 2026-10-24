"""Raw-color PAD offsets: exact channel order, raw input, bounds and parity."""
import importlib.util
from pathlib import Path
import unittest
import cv2
import numpy as np
ROOT=Path(__file__).resolve().parents[2]


def load(folder):
    spec=importlib.util.spec_from_file_location('raw_color_'+folder,ROOT/folder/'antispoof/lighting.py')
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    return module


class RawColorPADTests(unittest.TestCase):
    def profile(self):
        return dict(method='raw_color',reference_luma=110.,scale=50.,slope=2.,gap_scale=40.,gap_slope=8.,
                    cb_reference=128.,cr_reference=128.,chroma_scale=20.,cb_slope=7.,cr_slope=3.5,bias=-4.,max_offset=4.)

    def test_reference_channel_order_bounds_and_source_unchanged(self):
        for folder in ('face_auth','hardware'):
            module=load(folder);profile=self.profile();adapter=module.BrightnessThreshold(profile);base=-2.3
            for color in ((0,0,0),(255,255,255),(240,60,20),(20,60,240),(80,140,190)):
                crop=np.full((80,80,3),color,np.uint8);crop[16:64,16:64]=np.clip(np.array(color)+10,0,255)
                before=crop.copy();ycc=cv2.cvtColor(crop,cv2.COLOR_BGR2YCrCb)
                f=float(ycc[:,:,0].mean());c=float(ycc[16:64,16:64,0].mean());cb=float(ycc[16:64,16:64,2].mean());cr=float(ycc[16:64,16:64,1].mean())
                expected=base+np.clip(2*(c-110)/50+8*(c-f)/40+7*(cb-128)/20+3.5*(cr-128)/20-4,-4,4)
                self.assertAlmostEqual(adapter(crop,base),expected)
                self.assertEqual(module.raw_color_features(crop),(f,c,cb,cr))
                self.assertLessEqual(abs(adapter(crop,base)-base),4.)
                np.testing.assert_array_equal(crop,before)
            # A blue-only coefficient must follow Cb, never OpenCV channel1(Cr).
            adapter=module.BrightnessThreshold(dict(profile,slope=0,gap_slope=0,cr_slope=0,cb_slope=1,bias=0,max_offset=100))
            blue=np.full((80,80,3),(255,0,0),np.uint8);red=np.full((80,80,3),(0,0,255),np.uint8)
            self.assertGreater(adapter(blue,0),adapter(red,0))

    def test_invalid_profile_or_crop_fails(self):
        for folder in ('face_auth','hardware'):
            module=load(folder);p=self.profile()
            for update in (dict(chroma_scale=0),dict(gap_scale=-1),dict(cb_reference=300),dict(cr_reference=-1),dict(cb_slope=float('nan')),dict(bias=True)):
                with self.assertRaises(ValueError):module.BrightnessThreshold(dict(p,**update))
            with self.assertRaises(ValueError):module.BrightnessThreshold({k:v for k,v in p.items() if k!='bias'})
            adapter=module.BrightnessThreshold(p)
            for crop in (np.zeros((40,40,3),np.uint8),np.zeros((80,80,3),np.float32)):
                with self.assertRaises(ValueError):adapter(crop,0)
