const express = require("express");

const app = express();

app.use(express.json());


// ==========================================
// TEMPORARY JOB STORAGE
// ==========================================

const jobs = {};


// ==========================================
// HOME / HEALTH CHECK
// ==========================================

app.get("/", (req, res) => {

  res.json({
    status: "online",
    message: "ClipAI processing server is online.",
    processor: "ready"
  });

});


// ==========================================
// CREATE VOD PROCESSING JOB
// ==========================================

app.post("/process", (req, res) => {

  const { url } = req.body;

  console.log("=================================");
  console.log("NEW VOD REQUEST");
  console.log("URL:", url);
  console.log("=================================");


  // Check URL

  if (!url) {

    console.log("ERROR: No VOD URL");

    return res.status(400).json({
      success: false,
      error: "VOD URL is required."
    });

  }


  // Check supported platform

  const lowerUrl = url.toLowerCase();

  const supported =
    lowerUrl.includes("youtube.com") ||
    lowerUrl.includes("youtu.be") ||
    lowerUrl.includes("twitch.tv") ||
    lowerUrl.includes("kick.com");


  if (!supported) {

    console.log("ERROR: Unsupported platform");

    return res.status(400).json({
      success: false,
      error:
        "Only YouTube, Twitch and Kick links are supported."
    });

  }


  // Create unique Job ID

  const jobId =
    Date.now().toString(36) +
    Math.random().toString(36).substring(2, 8);


  // Create job

  jobs[jobId] = {

    jobId: jobId,

    url: url,

    status: "queued",

    progress: 0,

    moments: [],

    createdAt: new Date().toISOString()

  };


  console.log("JOB CREATED");
  console.log("Job ID:", jobId);
  console.log("Status: queued");


  // Send response

  return res.json({

    success: true,

    jobId: jobId,

    status: "queued",

    progress: 0,

    message:
      "VOD received and processing job created.",

    url: url

  });

});


// ==========================================
// CHECK JOB STATUS
// ==========================================

app.get("/status/:jobId", (req, res) => {

  const jobId = req.params.jobId;

  console.log("STATUS REQUEST");
  console.log("Job ID:", jobId);


  const job = jobs[jobId];


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

    moments: job.moments,

    createdAt: job.createdAt

  });

});


// ==========================================
// START SERVER
// ==========================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

  console.log(
    `ClipAI server running on port ${PORT}`
  );

});
