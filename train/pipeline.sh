#!/bin/bash
cd "$(dirname "$0")"
until grep -aq "UJI EKSTERN" ../train_round1.log; do sleep 15; done
echo "round1 selesai"; grep -a "^ep\|UJI" ../train_round1.log | tail -5
THREADS=16 python -u train.py refine 2>&1 | grep -a --line-buffered -v "Downloading\|%|" > ../train_refine.log
cat ../train_refine.log | tail -3
THREADS=16 python -u train.py round2 12 2>&1 | grep -a --line-buffered -v "Downloading\|%|" > ../train_round2.log
grep -a "^ep\|UJI\|VALID\|onnx" ../train_round2.log | tail -8
echo PIPELINE_DONE
