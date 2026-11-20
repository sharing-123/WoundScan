import os, numpy as np, cv2, json
D='data/wseg/wseg_dataset'
def axis_frac(m):
    m=(m>127).astype(np.uint8)*255
    if m.sum()==0: return None
    m=cv2.GaussianBlur(m,(0,0),0.8)
    gx=cv2.Sobel(m,cv2.CV_32F,1,0); gy=cv2.Sobel(m,cv2.CV_32F,0,1)
    mag=np.hypot(gx,gy); e=mag>mag.max()*0.3
    ax=np.minimum(np.abs(gx),np.abs(gy))/(np.maximum(np.abs(gx),np.abs(gy))+1e-6)
    return float((ax[e]<0.12).mean())
if __name__=='__main__':
    res={}
    for f in sorted(os.listdir(D+'/mask')):
        m=cv2.imread(f'{D}/mask/{f}',0)
        res[f]=axis_frac(m)
    json.dump(res,open('data/axis_frac.json','w'))
    v=np.array([x for x in res.values() if x is not None])
    print(len(v),np.percentile(v,[5,25,50,75,90,95]).round(3))
    print(np.histogram(v,bins=10,range=(0,1))[0])
