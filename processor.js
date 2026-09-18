const express = require("express");
const multer = require("multer");
const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");

const app = express();

app.use(express.json());

const upload = multer({
  dest: "/tmp/clipai-uploads/",
  limits: {
    fileSize: 500 * 1024 * 1024
  }
});

const jobs = {};

const PORT = process.env.PORT || 3000;

function runFFmpeg(args) {
  return new Promise((resolve, reject) => {

    execFile(
      "ffmpeg",
      args,
      {
        maxBuffer: 10 * 1024 * 1024
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


// ================================
// HEALTH CHECK
// ================================

app.get("/", (req, res) => {

  res.json({
    status: "online",
    message: "ClipAI processor is online.",
    processor: "FFmpeg ready"
  });

});


// ================================
// FFMPEG TEST
// ================================

app.get("/ffmpeg", async (req, res) => {

  try {

    const result =
      await runFFmpeg([
        "-version"
      ]);

    const firstLine =
      result.stdout.split("\n")[0];

    res.json({
      success: true,
      ffmpeg: firstLine
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      error: "FFmpeg is not available.",
      details: error.message
    });

  }

});


// ================================
// VIDEO FILE UPLOAD
// ================================

app.post(
  "/upload",
  upload.single("video"),
  async (req, res) => {

    if (!req.file) {

      return res.status(400).json({
        success: false,
        error: "No video file uploaded."
      });

    }

    const inputFile =
      req.file.path;

    const originalName =
      req.file.originalname;

    console.log(
      "================================="
    );

    console.log(
      "PROCESSOR: VIDEO UPLOAD"
    );

    console.log(
      "File:",
      originalName
    );

    console.log(
      "Size:",
      req.file.size
    );

    console.log(
      "================================="
    );


    const jobId =
      Date.now().toString(36) +
      Math.random()
        .toString(36)
        .substring(2, 8);


    const outputFile =
      path.join(
        "/tmp/clipai-uploads",
        `${jobId}.wav`
      );


    jobs[jobId] = {

      jobId,

      type: "file",

      filename:
        originalName,

      inputFile,

      outputFile,

      status: "processing",

      progress: 10,

      moments: [],

      createdAt:
        new Date().toISOString()

    };


    res.json({

      success: true,

      jobId,

      status: "processing",

      progress: 10,

      message:
        "Video uploaded. Audio extraction started."

    });


    try {

      console.log(
        "PROCESSOR: Extracting audio..."
      );


      jobs[jobId].progress = 25;


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


      if (!fs.existsSync(outputFile)) {

        throw new Error(
          "FFmpeg did not create the audio file."
        );

      }


      const audioStats =
        fs.statSync(outputFile);


      jobs[jobId].progress = 50;

      jobs[jobId].status =
        "audio_ready";

      jobs[jobId].audioSize =
        audioStats.size;


      console.log(
        "PROCESSOR: Audio extraction complete."
      );

      console.log(
        "Audio size:",
        audioStats.size
      );


    } catch (error) {

      console.log(
        "PROCESSOR: FFmpeg error:",
        error.message
      );


      jobs[jobId].status =
        "failed";

      jobs[jobId].progress = 0;

      jobs[jobId].error =
        error.message;


      try {

        if (fs.existsSync(inputFile)) {
          fs.unlinkSync(inputFile);
        }

        if (fs.existsSync(outputFile)) {
          fs.unlinkSync(outputFile);
        }

      } catch (_) {}

    }

  }
);


// ================================
// EXISTING VOD PROCESS ROUTE
// ================================

app.post("/process", (req, res) => {

  const { url } = req.body;


  if (!url) {

    return res.status(400).json({
      success: false,
      error: "VOD URL is required."
    });

  }


  const lowerUrl =
    url.toLowerCase();


  const supported =
    lowerUrl.includes("youtube.com") ||
    lowerUrl.includes("youtu.be") ||
    lowerUrl.includes("twitch.tv") ||
    lowerUrl.includes("kick.com");


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

    type: "vod",

    url,

    status: "queued",

    progress: 0,

    moments: [],

    createdAt:
      new Date().toISOString()

  };


  console.log(
    "PROCESSOR: VOD JOB CREATED",
    jobId
  );


  setTimeout(() => {

    if (!jobs[jobId]) {
      return;
    }

    jobs[jobId].status =
      "processing";

    jobs[jobId].progress =
      10;

  }, 3000);


  return res.json({

    success: true,

    jobId,

    status: "queued",

    progress: 0,

    message:
      "Processing job created.",

    url

  });

});


// ================================
// JOB STATUS
// ================================

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

        error: "Job not found."

      });

    }


    return res.json({

      success: true,

      jobId: job.jobId,

      status: job.status,

      progress: job.progress,

      moments:
        job.moments || [],

      filename:
        job.filename || null,

      audioSize:
        job.audioSize || null,

      error:
        job.error || null,

      createdAt:
        job.createdAt

    });

  }
);


app.listen(PORT, () => {

  console.log(
    `ClipAI processor running on port ${PORT}`
  );

});
