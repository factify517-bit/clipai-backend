const express = require("express");

const app = express();

app.use(express.json());

const jobs = {};


/*
========================================
HOME
========================================
*/

app.get("/", (req, res) => {

  res.json({
    status: "online",
    message: "ClipAI processor is online.",
    processor: "ready"
  });

});


/*
========================================
CREATE JOB
========================================
*/

app.post("/process", (req, res) => {

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


  const lowerUrl = url.toLowerCase();


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

    jobId: jobId,

    url: url,

    status: "queued",

    progress: 0,

    moments: [],

    createdAt:
      new Date().toISOString()

  };


  console.log("PROCESSOR: JOB CREATED");

  console.log(
    "Job ID:",
    jobId
  );


  /*
  --------------------------------------
  TEMPORARY PROCESSING STATE
  --------------------------------------

  Actual video processing will be added
  after the processor is separated from
  the API server.
  */

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

    jobId: jobId,

    status: "queued",

    progress: 0,

    message:
      "Processing job created.",

    url: url

  });

});


/*
========================================
JOB STATUS
========================================
*/

app.get("/status/:jobId", (req, res) => {

  const jobId =
    req.params.jobId;


  console.log(
    "PROCESSOR: STATUS REQUEST",
    jobId
  );


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

    moments: job.moments,

    createdAt: job.createdAt

  });

});


/*
========================================
START SERVER
========================================
*/

const PORT =
  process.env.PORT || 3000;


app.listen(PORT, () => {

  console.log(
    `ClipAI processor running on port ${PORT}`
  );

});
