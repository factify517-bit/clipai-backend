const express = require("express");
const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");

const app = express();

app.use(express.json());

const jobs = {};
const PORT = process.env.PORT || 3000;

function runFFmpeg(args) {
  return new Promise((resolve, reject) => {
    execFile("ffmpeg", args, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
        return;
      }

      resolve({
        stdout,
        stderr
      });
    });
  });
}

app.get("/", (req, res) => {
  res.json({
    status: "online",
    message: "ClipAI processor is online.",
    processor: "FFmpeg ready"
  });
});

app.get("/ffmpeg", async (req, res) => {
  try {
    const result = await runFFmpeg([
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

app.post("/process", async (req, res) => {

  const { url } = req.body;

  console.log("=================================");
  console.log("PROCESSOR: NEW JOB");
  console.log("URL:", url);
  console.log("=================================");

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
    url,
    status: "queued",
    progress: 0,
    moments: [],
    createdAt:
      new Date().toISOString()
  };

  console.log(
    "PROCESSOR: JOB CREATED",
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

    console.log(
      "PROCESSOR: JOB PROCESSING",
      jobId
    );

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

app.get("/status/:jobId", (req, res) => {

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

  res.json({
    success: true,
    jobId: job.jobId,
    status: job.status,
    progress: job.progress,
    moments: job.moments,
    createdAt: job.createdAt
  });
});

app.listen(PORT, () => {

  console.log(
    `ClipAI processor running on port ${PORT}`
  );

});
