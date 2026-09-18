const express = require("express");
const multer = require("multer");
const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");
const https = require("https");

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

const PORT = process.env.PORT || 3000;

const OPENAI_API_KEY =
  process.env.OPENAI_API_KEY;


// ========================================
// FFmpeg
// ========================================

function runFFmpeg(args) {

  return new Promise((resolve, reject) => {

    execFile(
      "ffmpeg",
      args,
      {
        maxBuffer:
          10 * 1024 * 1024
      },
      (error, stdout, stderr) => {

        if (error) {
          reject(
            new Error(
              stderr ||
              error.message
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


// ========================================
// OpenAI transcription
// ========================================

function transcribeAudio(audioFile) {

  return new Promise((resolve, reject) => {

    if (!OPENAI_API_KEY) {

      reject(
        new Error(
          "OPENAI_API_KEY is not configured."
        )
      );

      return;
    }


    const boundary =
      "----ClipAI" +
      Date.now();


    const audioData =
      fs.readFileSync(audioFile);


    const filename =
      path.basename(audioFile);


    const parts = [];


    parts.push(
      Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="model"\r\n\r\n` +
        `gpt-4o-mini-transcribe\r\n`
      )
    );


    parts.push(
      Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="response_format"\r\n\r\n` +
        `json\r\n`
      )
    );


    parts.push(
      Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
        `Content-Type: audio/wav\r\n\r\n`
      )
    );


    parts.push(audioData);


    parts.push(
      Buffer.from(
        `\r\n--${boundary}--\r\n`
      )
    );


    const body =
      Buffer.concat(parts);


    const request =
      https.request(
        {
          hostname:
            "api.openai.com",

          path:
            "/v1/audio/transcriptions",

          method:
            "POST",

          headers: {

            "Authorization":
              `Bearer ${OPENAI_API_KEY}`,

            "Content-Type":
              `multipart/form-data; boundary=${boundary}`,

            "Content-Length":
              body.length

          },

          timeout:
            120000

        },
        response => {

          let responseData = "";

          response.on(
            "data",
            chunk => {
              responseData += chunk;
            }
          );


          response.on(
            "end",
            () => {

              if (
                response.statusCode < 200 ||
                response.statusCode >= 300
              ) {

                reject(
                  new Error(
                    `OpenAI transcription error (${response.statusCode}): ${responseData}`
                  )
                );

                return;
              }


              try {

                const data =
                  JSON.parse(
                    responseData
                  );


                resolve(
                  data.text || ""
                );

              } catch (error) {

                reject(
                  new Error(
                    "Invalid transcription response."
                  )
                );

              }

            }
          );

        }
      );


    request.on(
      "error",
      error => {
        reject(error);
      }
    );


    request.on(
      "timeout",
      () => {

        request.destroy();

        reject(
          new Error(
            "Transcription request timed out."
          )
        );

      }
    );


    request.write(body);

    request.end();

  });

}


// ========================================
// Home
// ========================================

app.get("/", (req, res) => {

  res.json({

    status: "online",

    message:
      "ClipAI processor is online.",

    processor:
      "FFmpeg + AI transcription"

  });

});


// ========================================
// FFmpeg test
// ========================================

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

      ffmpeg:
        firstLine

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


// ========================================
// Video upload
// ========================================

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

      type:
        "file",

      filename:
        originalName,

      inputFile,

      outputFile,

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
      "PROCESSOR: NEW VIDEO"
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

      // --------------------------------
      // STEP 1: Extract audio
      // --------------------------------

      jobs[jobId].progress =
        25;


      console.log(
        "PROCESSOR: Extracting audio..."
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
        "PROCESSOR: Audio ready."
      );


      // --------------------------------
      // STEP 2: Transcription
      // --------------------------------

      jobs[jobId].status =
        "transcribing";


      jobs[jobId].progress =
        60;


      console.log(
        "PROCESSOR: Sending audio for transcription..."
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
        "PROCESSOR: Transcription complete."
      );


      console.log(
        "Transcript length:",
        transcript.length
      );


      // --------------------------------
      // Cleanup files
      // --------------------------------

      try {

        if (
          fs.existsSync(
            inputFile
          )
        ) {
          fs.unlinkSync(
            inputFile
          );
        }


        if (
          fs.existsSync(
            outputFile
          )
        ) {
          fs.unlinkSync(
            outputFile
          );
        }

      } catch (cleanupError) {

        console.log(
          "Cleanup warning:",
          cleanupError.message
        );

      }

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


      try {

        if (
          fs.existsSync(
            inputFile
          )
        ) {
          fs.unlinkSync(
            inputFile
          );
        }


        if (
          fs.existsSync(
            outputFile
          )
        ) {
          fs.unlinkSync(
            outputFile
          );
        }

      } catch (_) {}

    }

  }
);


// ========================================
// VOD URL route
// ========================================

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


// ========================================
// Status
// ========================================

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


// ========================================
// Start server
// ========================================

app.listen(
  PORT,
  () => {

    console.log(
      `ClipAI processor running on port ${PORT}`
    );

  }
);
