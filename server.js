const express = require("express");

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    status: "online",
    message: "ClipAI processing server is online."
  });
});

app.post("/process", (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({
      success: false,
      error: "VOD URL is required."
    });
  }

  res.json({
    success: true,
    status: "queued",
    message: "VOD received by processing server.",
    url: url,
    moments: []
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`ClipAI server running on port ${PORT}`);
});
