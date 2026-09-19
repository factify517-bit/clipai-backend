const express = require("express");
const multer = require("multer");
const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = "/tmp/clipai-uploads";
const PYTHON = "/opt/whisper/bin/python";
const TRANSCRIBE = "/app/transcribe.py";

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 500 * 1024 * 1024 }
});

const jobs = new Map();

function id() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        const message =
          `Command failed: ${cmd} ${args.join(" ")}\n` +
          `EXIT CODE: ${error.code || "unknown"}\n` +
          `STDOUT:\n${stdout || "(empty)"}\n` +
          `STDERR:\n${stderr || "(empty)"}`;

        console.error(message);
        reject(new Error(message));
        return;
      }

      resolve({ stdout, stderr });
    });
  });
}

async function processVideo(jobId, filePath) {
  const job = jobs.get(jobId);

  try {
    job.status = "processing";
    job.progress = 10;

    const wav = path.join(UPLOAD_DIR, `${jobId}.wav`);

    console.log("Extracting audio...");

    await run("ffmpeg", [
      "-y",
      "-i", filePath,
      "-vn",
      "-ac", "1",
      "-ar", "16000",
      "-c:a", "pcm_s16le",
      wav
    ]);

    job.progress = 35;

    console.log("Loading whisper model...");
    console.log("Transcribing audio...");

    const result = await run(PYTHON, [TRANSCRIBE, wav]);

    console.log("Whisper STDOUT:");
    console.log(result.stdout);

    console.log("Whisper STDERR:");
    console.log(result.stderr);

    let data;

    try {
      data = JSON.parse(result.stdout.trim());
    } catch {
      throw new Error(
        "Whisper returned invalid JSON.\n" +
        "OUTPUT:\n" + result.stdout +
        "\nERROR:\n" + result.stderr
      );
    }

    if (!data.success) {
      throw new Error(data.error || "Whisper transcription failed");
    }

    job.transcript = data.text || "";
    job.moments = [];
    job.progress = 100;
    job.status = "completed";

    console.log(`Job ${jobId} completed`);

    if (fs.existsSync(wav)) fs.unlinkSync(wav);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  } catch (error) {
    console.error("PROCESSOR ERROR:", error.message);

    job.status = "failed";
    job.progress = 0;
    job.error = error.message;

    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
}

app.get("/", (req, res) => {
  res.json({
    status: "online",
    service: "ClipAI processor"
  });
});

app.get("/ffmpeg", (req, res) => {
  execFile("ffmpeg", ["-version"], (error, stdout) => {
    if (error) {
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }

    res.json({
      success: true,
      ffmpeg: stdout.split("\n")[0]
    });
  });
});

app.post("/upload", upload.single("video"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: "No video uploaded"
    });
  }

  const jobId = id();

  jobs.set(jobId, {
    jobId,
    type: "upload",
    filename: req.file.originalname,
    status: "queued",
    progress: 0,
    transcript: "",
    moments: [],
    createdAt: Date.now()
  });

  res.json({
    success: true,
    jobId
  });

  processVideo(jobId, req.file.path);
});

app.post("/process", async (req, res) => {
  const url = req.body && req.body.url;

  if (!url) {
    return res.status(400).json({
      success: false,
      error: "Video URL is required"
    });
  }

  res.status(501).json({
    success: false,
    error: "URL processing is not enabled yet"
  });
});

app.get("/status/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);

  if (!job) {
    return res.status(404).json({
      success: false,
      error: "Job not found"
    });
  }

  res.json({
    success: true,
    job
  });
});

setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000;

  for (const [jobId, job] of jobs) {
    if (job.createdAt < cutoff) {
      jobs.delete(jobId);
    }
  }
}, 10 * 60 * 1000);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`ClipAI processor running on port ${PORT}`);
});
