import onnxruntime as ort, numpy as np, cv2, glob, os, sys
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
enc=ort.InferenceSession(ROOT+'/app/models/mobilesam.encoder.onnx',providers=['CPUExecutionProvider'])
dec=ort.InferenceSession(ROOT+'/app/models/mobilesam.decoder.onnx',providers=['CPUExecutionProvider'])
seg=ort.InferenceSession(ROOT+'/app/models/wound_seg.onnx',providers=['CPUExecutionProvider'])
S=256
def model_prob(img):
    x=cv2.resize(img,(S,S),interpolation=cv2.INTER_AREA).astype(np.float32)/255; x=x.transpose(2,0,1)[None]
    run=lambda a: seg.run(None,{'x':np.ascontiguousarray(a)})[0][0,0]
    p=(run(x)+run(x[...,::-1])[:,::-1]+run(x[:,:,::-1])[::-1])/3
    return cv2.resize(p,(img.shape[1],img.shape[0]),interpolation=cv2.INTER_LINEAR)
def bbox(m):
    ys,xs=np.nonzero(m); return xs.min(),ys.min(),xs.max(),ys.max()
def roi_prob(img,p,pad=0.6):
    m=p>0.5
    if m.sum()<30: return p
    x0,y0,x1,y1=bbox(m); w,h=x1-x0+1,y1-y0+1; s=max(w,h)*(1+2*pad)/2; cx,cy=(x0+x1)/2,(y0+y1)/2
    X0,Y0,X1,Y1=int(max(0,cx-s)),int(max(0,cy-s)),int(min(img.shape[1],cx+s)),int(min(img.shape[0],cy+s))
    crop=img[Y0:Y1,X0:X1]; pc=model_prob(crop); out=p.copy(); out[Y0:Y1,X0:X1]=pc; return out
def sam_refine(img,m):
    H,W=img.shape[:2]; x0,y0,x1,y1=bbox(m); bw,bh=x1-x0,y1-y0
    pad=0.08; bx0,by0,bx1,by1=x0-pad*bw,y0-pad*bh,x1+pad*bw,y1+pad*bh
    d=cv2.distanceTransform(m.astype(np.uint8),cv2.DIST_L2,5); y,x=np.unravel_index(d.argmax(),d.shape)
    sc=1024/max(H,W); emb=enc.run(None,{'input_image':img.astype(np.float32)})[0]
    pc=np.array([[[bx0*sc,by0*sc],[bx1*sc,by1*sc],[x*sc,y*sc]]],np.float32); pl=np.array([[2,3,1]],np.float32)
    o=dec.run(None,{'image_embeddings':emb,'point_coords':pc,'point_labels':pl,'mask_input':np.zeros((1,1,256,256),np.float32),'has_mask_input':np.zeros(1,np.float32),'orig_im_size':np.array([H,W],np.float32)})
    return o[0][0,0]>0
def dice(a,b): return 2*(a&b).sum()/max(a.sum()+b.sum(),1)
def accept(sm,m):
    iou=(sm&m).sum()/max((sm|m).sum(),1); r=sm.sum()/max(m.sum(),1); return iou>=0.6 and 0.6<=r<=1.6
D=ROOT+'/data/fuseg/data/Foot Ulcer Segmentation Challenge/validation'
fs=sorted(glob.glob(D+'/images/*'))[:int(sys.argv[1]) if len(sys.argv)>1 else 80]
R={'model':[], 'roi':[], 'sam':[], 'roi+sam':[]}; A={'model':[], 'roi':[], 'sam':[], 'roi+sam':[]}; acc=0
for f in fs:
    img=cv2.cvtColor(cv2.imread(f),cv2.COLOR_BGR2RGB); gt=cv2.imread(f.replace('images','labels').rsplit('.',1)[0]+'.png',0)>127
    if gt.sum()<50: continue
    p=model_prob(img); m=p>0.5; 
    if m.sum()<30: 
        for k in R: R[k].append(0.0); A[k].append(9.0)
        continue
    pr=roi_prob(img,p); mr=pr>0.5
    s1=sam_refine(img,m); a1=accept(s1,m); s1m=s1 if a1 else m
    s2=sam_refine(img,mr); a2=accept(s2,mr); s2m=s2 if a2 else mr
    acc+=a1
    for k,mm in [('model',m),('roi',mr),('sam',s1m),('roi+sam',s2m)]:
        R[k].append(dice(mm,gt)); A[k].append(abs(mm.sum()-gt.sum())/gt.sum())
print('n',len(R['model']),'sam accepted',acc)
for k in R: print(f'{k:8s} Dice {np.mean(R[k]):.4f}  mediana galat luas {np.median(A[k])*100:.1f}%  rerata {np.mean(A[k])*100:.1f}%')
