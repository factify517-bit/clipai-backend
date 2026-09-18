const express = require("express");

const app = express();

app.use(express.json());


// ===============================
// HOME / HEALTH CHECK
// ===============================

app.get("/", (req, res) => {

  res.json({
    status: "online",
    message: "ClipAI processing server is online.",
    processor: "ready"
  });

});


// ===============================
// PROCESS VOD
// ===============================

app.post("/process", (req, res) => {

  const { url } = req.body;

  console.log("=================================");
  console.log("NEW VOD REQUEST");
  console.log("URL:", url);
  console.log("=================================");


  // Check URL exists

  if (!url) {

    console.log("ERROR: No VOD URL");

    return res.status(400).json({

      success: false,

      error: "VOD URL is required."

    });

  }


  // Convert to lowercase for checking

  const lowerUrl = url.toLowerCase();


  // Supported platforms

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


  console.log("Platform check: OK");
  console.log("Processing status: queued");


  // Temporary response.
  // Actual video processing will be added next.

  return res.json({

    success: true,

    status: "queued",

    message:
      "VOD received. Processing server is ready.",

    url: url,

    moments: []

  });

});


// ===============================
// START SERVER
// ===============================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

  console.log(
    `ClipAI server running on port ${PORT}`
  );

});
