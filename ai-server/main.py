
from __future__ import annotations

import json
import os
import shutil
import subprocess
import threading
import uuid
from pathlib import Path
from typing import Any

from fastapi import BackgroundTasks, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

APP_DIR = Path(__file__).resolve().parent
DATA_DIR = Path(os.getenv("DATA_DIR", APP_DIR / "data"))
VIDEO_DIR = DATA_DIR / "videos"
RESULT_DIR = DATA_DIR / "results"
HIGHLIGHT_DIR = DATA_DIR / "highlights"
JOBS_FILE = DATA_DIR / "jobs.json"

for directory in (VIDEO_DIR, RESULT_DIR, HIGHLIGHT_DIR):
    directory.mkdir(parents=True, exist_ok=True)
if not JOBS_FILE.exists():
    JOBS_FILE.write_text("{}", encoding="utf-8")

app = FastAPI(title="SOCCER VISION ANALYZER PRO AI Server", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

jobs_lock = threading.Lock()


class AnalyzeRequest(BaseModel):
    video_id: str
    match_id: str | None = None


class Clip(BaseModel):
    start: float = Field(ge=0)
    end: float = Field(gt=0)
    label: str = ""


class HighlightRequest(BaseModel):
    video_id: str
    match_id: str | None = None
    clips: list[Clip]


def load_jobs() -> dict[str, Any]:
    with jobs_lock:
        return json.loads(JOBS_FILE.read_text(encoding="utf-8"))


def update_job(job_id: str, **values: Any) -> None:
    with jobs_lock:
        jobs = json.loads(JOBS_FILE.read_text(encoding="utf-8"))
        jobs[job_id] = {**jobs.get(job_id, {}), **values}
        JOBS_FILE.write_text(json.dumps(jobs, ensure_ascii=False, indent=2), encoding="utf-8")


def find_video(video_id: str) -> Path:
    matches = list(VIDEO_DIR.glob(f"{video_id}.*"))
    if not matches:
        raise HTTPException(status_code=404, detail="Video not found")
    return matches[0]


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "SVA PRO AI Server"}


@app.post("/videos")
async def upload_video(file: UploadFile = File(...), match_id: str = "") -> dict[str, str]:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required")
    suffix = Path(file.filename).suffix.lower() or ".mp4"
    video_id = str(uuid.uuid4())
    destination = VIDEO_DIR / f"{video_id}{suffix}"
    with destination.open("wb") as output:
        shutil.copyfileobj(file.file, output)
    return {"video_id": video_id, "match_id": match_id, "filename": destination.name}


@app.post("/jobs/analyze")
def create_analysis_job(request: AnalyzeRequest, background_tasks: BackgroundTasks) -> dict[str, str]:
    find_video(request.video_id)
    job_id = str(uuid.uuid4())
    update_job(
        job_id,
        id=job_id,
        video_id=request.video_id,
        match_id=request.match_id,
        status="queued",
        progress=0,
        message="待機中",
        result={},
    )
    background_tasks.add_task(run_tracking, job_id, request.video_id)
    return {"job_id": job_id, "status": "queued"}


@app.get("/jobs/{job_id}")
def get_job(job_id: str) -> dict[str, Any]:
    job = load_jobs().get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


def run_tracking(job_id: str, video_id: str) -> None:
    try:
        update_job(job_id, status="processing", progress=10, message="モデルを準備中")
        source = find_video(video_id)
        output_json = RESULT_DIR / f"{job_id}.json"

        try:
            from ultralytics import YOLO
        except ImportError as exc:
            raise RuntimeError("ultralyticsがインストールされていません") from exc

        model_name = os.getenv("YOLO_MODEL", "yolo11n.pt")
        model = YOLO(model_name)
        update_job(job_id, progress=25, message="選手・ボールを追跡中")

        detections: list[dict[str, Any]] = []
        results = model.track(
            source=str(source),
            stream=True,
            persist=True,
            tracker=os.getenv("YOLO_TRACKER", "bytetrack.yaml"),
            classes=[0, 32],  # COCO: person, sports ball
            verbose=False,
        )

        frame_index = 0
        for result in results:
            frame_index += 1
            boxes = result.boxes
            if boxes is not None:
                ids = boxes.id.int().cpu().tolist() if boxes.id is not None else [None] * len(boxes)
                classes = boxes.cls.int().cpu().tolist()
                confidences = boxes.conf.cpu().tolist()
                xywhn = boxes.xywhn.cpu().tolist()
                for track_id, class_id, confidence, coords in zip(ids, classes, confidences, xywhn):
                    detections.append({
                        "frame": frame_index,
                        "track_id": track_id,
                        "class_id": class_id,
                        "class_name": "person" if class_id == 0 else "sports_ball",
                        "confidence": round(float(confidence), 4),
                        "x": round(float(coords[0]), 5),
                        "y": round(float(coords[1]), 5),
                        "width": round(float(coords[2]), 5),
                        "height": round(float(coords[3]), 5),
                    })
            if frame_index % 100 == 0:
                update_job(job_id, progress=min(90, 25 + frame_index // 20), message=f"{frame_index}フレーム処理済み")

        output_json.write_text(json.dumps({"detections": detections}, ensure_ascii=False), encoding="utf-8")
        update_job(
            job_id,
            status="completed",
            progress=100,
            message=f"完了: {len(detections)}件を検出",
            result={"detections_url": f"/results/{output_json.name}", "count": len(detections)},
        )
    except Exception as exc:
        update_job(job_id, status="failed", progress=100, message=str(exc))


@app.get("/results/{filename}")
def get_result(filename: str) -> FileResponse:
    path = RESULT_DIR / Path(filename).name
    if not path.exists():
        raise HTTPException(status_code=404, detail="Result not found")
    return FileResponse(path)


@app.post("/highlights")
def create_highlights(request: HighlightRequest) -> dict[str, str]:
    source = find_video(request.video_id)
    if not request.clips:
        raise HTTPException(status_code=400, detail="Clips are required")

    work_dir = HIGHLIGHT_DIR / str(uuid.uuid4())
    work_dir.mkdir(parents=True)
    clip_files: list[Path] = []

    for index, clip in enumerate(request.clips):
        if clip.end <= clip.start:
            raise HTTPException(status_code=400, detail="Clip end must be after start")
        output = work_dir / f"clip_{index:03d}.mp4"
        command = [
            "ffmpeg", "-y", "-ss", str(clip.start), "-to", str(clip.end),
            "-i", str(source),
            "-vf", "scale=1280:-2,fps=30",
            "-c:v", "libx264", "-preset", "fast", "-crf", "22",
            "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart",
            str(output),
        ]
        subprocess.run(command, check=True, capture_output=True)
        clip_files.append(output)

    concat_file = work_dir / "concat.txt"
    concat_file.write_text(
        "\n".join(f"file '{path.as_posix()}'" for path in clip_files),
        encoding="utf-8",
    )
    final_name = f"highlight_{uuid.uuid4()}.mp4"
    final_path = HIGHLIGHT_DIR / final_name
    subprocess.run(
        ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(concat_file), "-c", "copy", "-movflags", "+faststart", str(final_path)],
        check=True,
        capture_output=True,
    )
    shutil.rmtree(work_dir, ignore_errors=True)
    return {"download_url": f"/highlights/{final_name}"}


@app.get("/highlights/{filename}")
def download_highlight(filename: str) -> FileResponse:
    path = HIGHLIGHT_DIR / Path(filename).name
    if not path.exists():
        raise HTTPException(status_code=404, detail="Highlight not found")
    return FileResponse(path, media_type="video/mp4", filename=path.name)
