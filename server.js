const express = require("express");

const app = express();

app.use(express.json());

const RAILWAY_PROCESSOR =
  "https://clipai-backend-production-a6f3.up.railway.app";

app.get("/", (req, res) => {
  res.json({
    status: "online",
    message: "ClipAI API server is online.",
    processor: "Railway connected"
  });
});


/*
========================================
CREATE PROCESSING JOB
========================================
*/

app.post("/process", async (req, res) => {

  const { url } = req.body;

  console.log("=================================");
  console.log("NEW VOD REQUEST");
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


  try {

    console.log("Sending job to Railway...");


    const railwayResponse = await fetch(
      `${RAILWAY_PROCESSOR}/process`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          url: url
        })
      }
    );


    const railwayText =
      await railwayResponse.text();


    console.log(
      "Railway response:",
      railwayText
    );


    if (!railwayResponse.ok) {

      return res.status(502).json({
        success: false,
        error:
          "Railway processor returned an error.",
        details:
          railwayText
      });
    }


    let railwayData;


    try {

      railwayData =
        JSON.parse(railwayText);

    } catch (error) {

      return res.status(502).json({
        success: false,
        error:
          "Railway returned an invalid response.",
        details:
          railwayText
      });
    }


    return res.json(railwayData);


  } catch (error) {

    console.log(
      "Railway connection error:",
      error.message
    );


    return res.status(502).json({
      success: false,
      error:
        "Could not connect to Railway processor.",
      details:
        error.message
    });
  }

});


/*
========================================
CHECK JOB STATUS
========================================
*/

app.get("/status/:jobId", async (req, res) => {

  const jobId =
    req.params.jobId;


  console.log(
    "STATUS REQUEST:",
    jobId
  );


  if (!jobId) {

    return res.status(400).json({
      success: false,
      error: "Job ID is required."
    });
  }


  try {

    const railwayResponse =
      await fetch(
        `${RAILWAY_PROCESSOR}/status/${jobId}`,
        {
          method: "GET"
        }
      );


    const railwayText =
      await railwayResponse.text();


    console.log(
      "Railway status:",
      railwayText
    );


    if (!railwayResponse.ok) {

      return res.status(
        railwayResponse.status
      ).json({
        success: false,
        error:
          "Railway processor returned a status error.",
        details:
          railwayText
      });
    }


    let railwayData;


    try {

      railwayData =
        JSON.parse(railwayText);

    } catch (error) {

      return res.status(502).json({
        success: false,
        error:
          "Railway returned an invalid status response.",
        details:
          railwayText
      });
    }


    return res.json(railwayData);


  } catch (error) {

    console.log(
      "Railway status connection error:",
      error.message
    );


    return res.status(502).json({
      success: false,
      error:
        "Could not connect to Railway processor.",
      details:
        error.message
    });
  }

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
    `ClipAI API server running on port ${PORT}`
  );

});
