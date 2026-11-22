"""Create (or update) a Hugging Face Space for WoundScan and upload the app, the built-in Dockerfile and the model weights.

    pip install -U huggingface_hub
    python deploy/push_hf.py --space woundscan                      # asks for your Hugging Face token once, hidden
    python deploy/push_hf.py --space woundscan --database-url "postgresql://..."   # persistent cases (Neon, Supabase)
    python deploy/push_hf.py --space woundscan --private            # only you can open it

The token is read by huggingface_hub (getpass, or the HF_TOKEN environment variable); it is never written to a file here.
Public Space means the model weights are public too: they were trained on data released for non-commercial use.
"""
import argparse
import os
import shutil
import sys
import tempfile
from pathlib import Path

from huggingface_hub import HfApi, login, whoami

ROOT = Path(__file__).resolve().parents[1]
KEEP = [
    "Dockerfile", "server/requirements.txt", "server/run.py", "server/app", "src/woundscan",
    "web/package.json", "web/package-lock.json", "web/index.html", "web/tsconfig.json", "web/vite.config.ts", "web/src", "web/public",
    "models/wound_seg.onnx", "models/wound_seg_medetec_adapted_320.onnx", "models/meta.json", "models/medetec_cv_metrics.json",
    "models/type/type_cls.onnx", "models/type/type_cls.json",
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--space", default="woundscan")
    ap.add_argument("--user", default=None, help="Hugging Face user or organisation (default: the token's owner)")
    ap.add_argument("--private", action="store_true")
    ap.add_argument("--database-url", default=os.environ.get("DATABASE_URL", ""))
    a = ap.parse_args()

    if not os.environ.get("HF_TOKEN"):
        login()  # hidden prompt
    who = whoami()["name"]
    repo = f"{a.user or who}/{a.space}"
    api = HfApi()
    missing = [k for k in KEEP if not (ROOT / k).exists()]
    if missing:
        sys.exit("missing files: " + ", ".join(missing))

    with tempfile.TemporaryDirectory() as tmp:
        stage = Path(tmp)
        for k in KEEP:
            src, dst = ROOT / k, stage / k
            dst.parent.mkdir(parents=True, exist_ok=True)
            if src.is_dir():
                shutil.copytree(src, dst, ignore=shutil.ignore_patterns("__pycache__", "node_modules", "*.pyc"))
            else:
                shutil.copy2(src, dst)
        shutil.copy2(ROOT / "deploy" / "hf-README.md", stage / "README.md")
        api.create_repo(repo, repo_type="space", space_sdk="docker", private=a.private, exist_ok=True)
        if a.database_url:
            api.add_space_secret(repo, "DATABASE_URL", a.database_url)
        api.upload_folder(folder_path=str(stage), repo_id=repo, repo_type="space", commit_message="WoundScan full stack")
    host = repo.replace("/", "-").replace("_", "-").lower()
    print(f"\nUploaded. The Space builds the Docker image now (5 to 8 minutes the first time).")
    print(f"Page:   https://huggingface.co/spaces/{repo}")
    print(f"Public: https://{host}.hf.space")
    print(f"Health: https://{host}.hf.space/api/health")


if __name__ == "__main__":
    main()
