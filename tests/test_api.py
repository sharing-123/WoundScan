import math
import numpy as np
import pytest
from woundscan import measure_mask, reference_scale, body_surface_area, Segmenter


def test_rectangle():
    m = np.zeros((20,30), dtype=bool)
    m[2:12,5:25] = True
    result = measure_mask(m, .5, height_cm=180, weight_kg=80)
    assert result.area_mm2 == 50
    assert result.perimeter_mm == 30
    assert result.tbsa_percent == pytest.approx(.0025)
    assert result.to_dict()['foreground_pixels'] == 200


def test_holes_and_empty():
    m = np.ones((3,3), dtype=int); m[1,1] = 0
    assert measure_mask(m,1).perimeter_mm == 16
    assert measure_mask(m,1).area_mm2 == 8
    assert measure_mask(np.zeros((2,3)),1).area_mm2 == 0


def test_units():
    assert reference_scale(100,10) == .1
    assert body_surface_area(180,80) == 2


@pytest.mark.parametrize('bad',[0,-1,math.nan,math.inf])
def test_bad_scale(bad):
    with pytest.raises(ValueError): measure_mask([[1]],bad)


@pytest.mark.parametrize('bad',[[],[1,0],[[0,2]],[[math.nan]],[[.5]], [['bad']]])
def test_bad_mask(bad):
    with pytest.raises(ValueError): measure_mask(bad,1)


def test_pair():
    with pytest.raises(ValueError): measure_mask([[1]],1,height_cm=170)


def test_missing_model():
    with pytest.raises(FileNotFoundError): Segmenter('nonexistent.onnx')


def test_inference_transforms():
    cv2=pytest.importorskip('cv2')
    class Session:
        def run(self,outputs,feed): return [feed['x'][:,:1]]
    model=Segmenter.__new__(Segmenter)
    model._session,model._input,model._cv2=Session(),'x',cv2
    rgb=np.zeros((256,256,3),dtype=np.uint8)
    rgb[:,:,0]=np.arange(256,dtype=np.uint8)[None,:]
    expected=rgb[:,:,0].astype(np.float32)/255
    np.testing.assert_allclose(model.predict(rgb),expected,atol=1e-7)
    np.testing.assert_array_equal(model.segment(rgb),expected>.5)
    with pytest.raises(ValueError): model.predict(rgb.astype(float))


def test_geometry_invariants():
    rng=np.random.default_rng(73)
    for _ in range(50):
        m=rng.integers(0,2,(13,17))
        original=measure_mask(m,.2)
        for transformed in [m.T,np.flipud(m),np.fliplr(m),np.pad(m,4)]:
            result=measure_mask(transformed,.2)
            assert result.area_mm2 == original.area_mm2
            assert result.perimeter_mm == original.perimeter_mm
        scaled=measure_mask(m,.4)
        assert scaled.area_mm2 == pytest.approx(original.area_mm2*4)
        assert scaled.perimeter_mm == pytest.approx(original.perimeter_mm*2)


@pytest.mark.parametrize("bad", [np.array([[1+0j]]), np.array([[1]], dtype=object)])
def test_non_numeric_mask_types(bad):
    with pytest.raises(ValueError):
        measure_mask(bad, 1)
