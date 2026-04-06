
from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import subprocess, time, os

app = FastAPI(title="Portal Shell Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Cmd(BaseModel):
    cmd: str

WINDOWS_MAP = {
    "ls": "dir",
    "ls -la": "dir",
    "pwd": "cd",
    "python --version": "python --version",
    "pip --version": "pip --version",
    "where python": "where python",
    "echo hello": "echo hello",
}
POSIX_MAP = {
    "ls": "ls",
    "ls -la": "ls -la",
    "pwd": "pwd",
    "python --version": "python --version",
    "pip --version": "pip --version",
    "where python": "which python",
    "echo hello": "echo hello",
}

def resolve_command(cmd: str):
    cmd = (cmd or "").strip()
    if os.name == "nt":
        return WINDOWS_MAP.get(cmd)
    return POSIX_MAP.get(cmd)

@app.get("/health")
def health():
    return {"ok": True, "platform": os.name}

@app.post("/run")
def run(c: Cmd):
    resolved = resolve_command(c.cmd)
    if not resolved:
        return {"error": "blocked", "allowed": list(WINDOWS_MAP if os.name == "nt" else POSIX_MAP)}
    start = time.time()
    completed = subprocess.run(
        resolved,
        shell=True,
        capture_output=True,
        text=True,
        timeout=8
    )
    return {
        "requested": c.cmd,
        "resolved": resolved,
        "output": completed.stdout,
        "error": completed.stderr,
        "code": completed.returncode,
        "duration": round(time.time() - start, 2)
    }
