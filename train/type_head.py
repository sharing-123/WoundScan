"""Train the wound-type head on encoder features (CV report + final fit) -> models/type/head.json"""
import json, numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold, cross_val_predict
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score, balanced_accuracy_score, confusion_matrix, classification_report

X = np.load('models/type/features.npy'); lab = json.load(open('models/type/labels.json'))['labels']
keep = np.array([l.strip() != '' for l in lab]); X = X[keep]; lab = [l for l, k in zip(lab, keep) if k]
classes = sorted(set(lab)); y = np.array([classes.index(l) for l in lab])
mu, sd = X.mean(0), X.std(0) + 1e-6; Z = (X - mu) / sd
best = None
for C in (0.003, 0.01, 0.03, 0.1):
    clf = LogisticRegression(C=C, max_iter=3000, class_weight='balanced')
    p = cross_val_predict(clf, Z, y, cv=StratifiedKFold(5, shuffle=True, random_state=0), method='predict_proba')
    acc = accuracy_score(y, p.argmax(1)); bal = balanced_accuracy_score(y, p.argmax(1)); print('C', C, 'acc %.3f bal %.3f' % (acc, bal))
    if best is None or bal > best[0]: best = (bal, C, p, acc)
bal, C, p, acc = best
print(classification_report(y, p.argmax(1), target_names=classes, digits=3)); print(confusion_matrix(y, p.argmax(1)))
conf = p.max(1); order = np.argsort(-conf)
for q in (0.5, 0.7, 0.85):
    k = conf >= q; print('conf>=%.2f coverage %.2f acc %.3f' % (q, k.mean(), accuracy_score(y[k], p.argmax(1)[k])))
clf = LogisticRegression(C=C, max_iter=3000, class_weight='balanced').fit(Z, y)
json.dump({'classes': classes, 'mean': mu.tolist(), 'std': sd.tolist(), 'coef': clf.coef_.tolist(), 'intercept': clf.intercept_.tolist(),
           'C': C, 'cv_accuracy': acc, 'cv_balanced_accuracy': bal, 'n': int(len(y)), 'counts': {c: int((y == i).sum()) for i, c in enumerate(classes)},
           'per_class_recall': {c: float(((p.argmax(1) == i) & (y == i)).sum() / (y == i).sum()) for i, c in enumerate(classes)}}, open('models/type/head.json', 'w'))
