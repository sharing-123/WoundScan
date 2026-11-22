"""Start the WoundScan site + API on http://127.0.0.1:8780 (loopback only)."""
import uvicorn

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="127.0.0.1", port=8780, log_level="info")
