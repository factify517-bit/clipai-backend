const express = require("express");
const multer = require("multer");
const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");

const app = express();

app.use(express.json());

const uploadDir = "/tmp/clipai-uploads";

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 500 * 1024 * 1024
  }
});

const jobs = {};

const PORT = process.env.PORT || 8080;

const PYTHON =
  "/opt/whisper/bin/python";

function runFFmpeg(args) {
  return new Promise((resolve, reject) => {
    execFile(
      "ffmpeg",
      args,
      {
        maxBuffer: 20 * 1024 * 1024
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(
            new Error(
              stderr || error.message
            )
          );
          return;
        }

        resolve({
          stdout,
          stderr
        });
      }
    );
  });
}

function transcribeAudio(audioFile) {
  return new Promise((resolve, reject) => {
    execFile(
      PYTHON,
      [
        "/app/transcribe.py",
        audioFile
      ],
      {
        timeout: 600000,
        maxBuffer: 20 * 1024 * 1024
      },
      (error, stdout, stderr) => {

        if (error) {
          reject(
            new Error(
              stderr ||
              stdout ||
              error.message
            )
          );
          return;
        }

        try {

          const lines =
            stdout
              .trim()
              .split("\n");

          const lastLine =
            lines[lines.length - 1];

          const data =
            JSON.parse(lastLine);

          if (!data.success) {
            reject(
              new Error(
                data.error ||
                "Transcription failed."
              )
            );
            return;
          }

          resolve(
            data.text || ""
          );

        } catch (parseError) {

          reject(
            new Error(
              "Invalid Whisper response."
            )
          );

        }
      }
    );
  });
}

function cleanupFile(file) {
  try {
    if (file && fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  } catch (_) {}
}

app.get("/", (req, res) => {
  res.json({
    status: "online",
    message:
      "ClipAI processor is online.",
    processor:
      "FFmpeg + Local Whisper"
  });
});

app.get("/ffmpeg", async (req, res) => {
  try {

    const result =
      await runFFmpeg([
        "-version"
      ]);

    const firstLine =
      result.stdout
        .split("\n")[0];

    res.json({
      success: true,
      ffmpeg: firstLine
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      error:
        "FFmpeg is not available.",
      details:
        error.message
    });

  }
});

app.post(
  "/upload",
  upload.single("video"),
  async (req, res) => {

    if (!req.file) {

      return res.status(400).json({
        success: false,
        error:
          "No video file uploaded."
      });

    }

    const inputFile =
      req.file.path;

    const originalName =
      req.file.originalname;

    const jobId =
      Date.now().toString(36) +
      Math.random()
        .toString(36)
        .substring(2, 8);

    const outputFile =
      path.join(
        uploadDir,
        `${jobId}.wav`
      );

    jobs[jobId] = {

      jobId,

      type: "file",

      filename:
        originalName,

      status:
        "processing",

      progress:
        10,

      transcript:
        "",

      moments:
        [],

      createdAt:
        new Date().toISOString()

    };

    console.log(
      "================================="
    );

    console.log(
      "NEW VIDEO"
    );

    console.log(
      "File:",
      originalName
    );

    console.log(
      "Job:",
      jobId
    );

    console.log(
      "================================="
    );

    res.json({

      success: true,

      jobId,

      status:
        "processing",

      progress:
        10,

      message:
        "Video uploaded. Processing started."

    });

    try {

      jobs[jobId].progress =
        25;

      console.log(
        "Extracting audio..."
      );

      await runFFmpeg([
        "-y",
        "-i",
        inputFile,
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-c:a",
        "pcm_s16le",
        outputFile
      ]);

      if (
        !fs.existsSync(
          outputFile
        )
      ) {

        throw new Error(
          "FFmpeg did not create audio."
        );

      }

      jobs[jobId].progress =
        50;

      console.log(
        "Audio extraction complete."
      );

      jobs[jobId].status =
        "transcribing";

      jobs[jobId].progress =
        60;

      console.log(
        "Starting local Whisper..."
      );

      const transcript =
        await transcribeAudio(
          outputFile
        );

      jobs[jobId].transcript =
        transcript;

      jobs[jobId].progress =
        100;

      jobs[jobId].status =
        "completed";

      console.log(
        "Whisper transcription complete."
      );

      console.log(
        "Transcript length:",
        transcript.length
      );

      cleanupFile(inputFile);
      cleanupFile(outputFile);

    } catch (error) {

      console.log(
        "PROCESSOR ERROR:",
        error.message
      );

      jobs[jobId].status =
        "failed";

      jobs[jobId].progress =
        0;

      jobs[jobId].error =
        error.message;

      cleanupFile(inputFile);
      cleanupFile(outputFile);

    }

  }
);

app.post(
  "/process",
  (req, res) => {

    const { url } =
      req.body;

    if (!url) {

      return res.status(400).json({
        success: false,
        error:
          "VOD URL is required."
      });

    }

    const lowerUrl =
      url.toLowerCase();

    const supported =
      lowerUrl.includes(
        "youtube.com"
      ) ||
      lowerUrl.includes(
        "youtu.be"
      ) ||
      lowerUrl.includes(
        "twitch.tv"
      ) ||
      lowerUrl.includes(
        "kick.com"
      );

    if (!supported) {

      return res.status(400).json({
        success: false,
        error:
          "Only YouTube, Twitch and Kick links are supported."
      });

    }

    const jobId =
      Date.now().toString(36) +
      Math.random()
        .toString(36)
        .substring(2, 8);

    jobs[jobId] = {

      jobId,

      type:
        "vod",

      url,

      status:
        "queued",

      progress:
        0,

      transcript:
        "",

      moments:
        [],

      createdAt:
        new Date().toISOString()

    };

    return res.json({

      success: true,

      jobId,

      status:
        "queued",

      progress:
        0,

      message:
        "Processing job created.",

      url

    });

  }
);

app.get(
  "/status/:jobId",
  (req, res) => {

    const jobId =
      req.params.jobId;

    const job =
      jobs[jobId];

    if (!job) {

      return res.status(404).json({
        success: false,
        error:
          "Job not found."
      });

    }

    res.json({

      success: true,

      jobId:
        job.jobId,

      status:
        job.status,

      progress:
        job.progress,

      transcript:
        job.transcript || "",

      moments:
        job.moments || [],

      filename:
        job.filename || null,

      error:
        job.error || null,

      createdAt:
        job.createdAt

    });

  }
);

app.listen(
  PORT,
  () => {

    console.log(
      `ClipAI processor running on port ${PORT}`
    );

  }
);
