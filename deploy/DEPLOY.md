# Deploying WoundScan as a real full-stack service

WoundScan needs a Python process (FastAPI + onnxruntime, about 1 GB of RAM with the three models loaded), a database and the built website. A static host such as Vercel cannot run that, so use a container host.

## Recommended: Hugging Face Spaces (Docker) + a free PostgreSQL

| Part | Choice | Why |
|---|---|---|
| App | Hugging Face Space, SDK **Docker** | free CPU Space with 16 GB RAM, HTTPS, deploys from `git push`, no card |
| Database | Neon or Supabase free PostgreSQL via `DATABASE_URL` | a free Space has no persistent disk; Postgres keeps cases across restarts |
| Models | committed to the Space repo with Git LFS | weights are not in the GitHub repo |

Other hosts work with the same `Dockerfile`: Fly.io, Railway, Render (needs a paid plan for 2 GB RAM), Google Cloud Run, any VPS with Docker.

### Steps

1. Create a Space at huggingface.co/new-space, SDK Docker, **Private** (see the licence note below). Name it for example `woundscan`.
2. Create a free PostgreSQL database (Neon: neon.tech) and copy its connection string, `postgresql://user:password@host/db?sslmode=require`.
3. In the Space, Settings, Variables and secrets: add a **secret** named `DATABASE_URL` with that string.
4. Upload everything with one command (it asks for your Hugging Face write token once, hidden, and creates the Space if it does not exist):

```powershell
pip install -U huggingface_hub
python deploy/push_hf.py --space woundscan --database-url "postgresql://user:password@host/db?sslmode=require"
# add --private to keep it to yourself; leave --database-url out to use SQLite on the Space (cases are lost when it restarts)
```

The Space builds the `Dockerfile` (about 5 to 8 minutes the first time) and starts on port 7860. Check `https://YOUR_USER-woundscan.hf.space/api/health`: it lists the models and `"database": "postgresql"`.

### What the container does

* serves the website and the API from one process on `$PORT` (7860 by default);
* keeps each browser's saved cases in its own workspace (a random id in that browser's storage), so visitors do not see each other's cases;
* starts and answers `503` with a clear message if model weights are missing, instead of crashing.

### Licence and privacy notes

* The weights were trained on data released for non-commercial use. A **private** Space (or an access-controlled one) keeps you inside that; do not make a public Space or a commercial service from them without checking the dataset licences.
* Do not upload identifiable patient photographs to a shared instance. Patient codes are pseudonyms, and the workspace id is separation, not authentication. Put the Space behind login or a VPN if real cases will be saved.

### Run it yourself with Docker

```powershell
docker build -t woundscan .
docker run --rm -p 7860:7860 -v woundscan-data:/data woundscan                       # SQLite on the volume
docker run --rm -p 7860:7860 -e DATABASE_URL="postgresql://..." woundscan            # PostgreSQL
```
