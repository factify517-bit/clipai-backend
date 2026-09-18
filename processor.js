const express = require("express");
const multer = require("multer");
const { execFile } = require("child_process");
const fs = require("fs");

const app = express();
app.use(express.json());

const DIR = "/tmp/clipai-uploads";
if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });

const upload = multer({
  dest: DIR,
  limits: { fileSize: 500 * 1024 * 1024 }
});

const jobs = {};
const PORT = process.env.PORT || 3000;

function ffprobe(file) {
  return new Promise((resolve, reject) => {
    execFile("ffprobe", [
      "-v", "quiet",
      "-print_format", "json",
      "-show_format",
      "-show_streams",
      file
    ], (err, stdout) => {
      if (err) reject(err);
      else resolve(JSON.parse(stdout));
    });
  });
}

function formatTime(sec) {
  sec = Math.floor(Number(sec) || 0);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;

  return h
    ? `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`
    : `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

app.get("/", (req, res) => {
  res.json({
    status: "online",
    message: "ClipAI processor is online."
  });
});

app.get("/ffmpeg", (req, res) => {
  execFile("ffmpeg", ["-version"], (err, stdout) => {
    if (err) return res.status(500).json({
      success: false,
      error: "FFmpeg is not available."
    });

    res.json({
      success: true,
      ffmpeg: stdout.split("\n")[0]
    });
  });
});

app.post("/upload", upload.single("video"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: "No video file uploaded."
    });
  }

  const id =
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 7);

  const file = req.file.path;

  jobs[id] = {
    jobId: id,
    filename: req.file.originalname,
    status: "processing",
    progress: 20,
    transcript: "",
    moments: [],
    videoInfo: null,
    createdAt: new Date().toISOString()
  };

  res.json({
    success: true,
    jobId: id,
    status: "processing",
    progress: 20
  });

  try {
    const data = await ffprobe(file);
    const video = data.streams.find(s => s.codec_type === "video");

    jobs[id].videoInfo = {
      duration: formatTime(data.format.duration),
      durationSeconds: Number(data.format.duration || 0),
      size: Number(data.format.size || req.file.size),
      resolution: video
        ? `${video.width}x${video.height}`
        : null,
      fps: video?.r_frame_rate || null
    };

    jobs[id].progress = 100;
    jobs[id].status = "completed";

    fs.unlinkSync(file);

  } catch (err) {
    jobs[id].status = "failed";
    jobs[id].progress = 0;
    jobs[id].error = err.message;

    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
});

app.post("/process", (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({
      success: false,
      error: "VOD URL is required."
    });
  }

  const id =
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 7);

  jobs[id] = {
    jobId: id,
    type: "vod",
    url,
    status: "queued",
    progress: 0,
    moments: [],
    createdAt: new Date().toISOString()
  };

  res.json({
    success: true,
    jobId: id,
    status: "queued",
    progress: 0
  });
});

app.get("/status/:jobId", (req, res) => {
  const job = jobs[req.params.jobId];

  if (!job) {
    return res.status(404).json({
      success: false,
      error: "Job not found."
    });
  }

  res.json({
    success: true,
    jobId: job.jobId,
    status: job.status,
    progress: job.progress,
    transcript: job.transcript || "",
    moments: job.moments || [],
    filename: job.filename || null,
    videoInfo: job.videoInfo || null,
    error: job.error || null
  });
});

app.listen(PORT, () => {
  console.log(`ClipAI processor running on port ${PORT}`);
});
