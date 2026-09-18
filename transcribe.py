import sys
import json
import whisper


def main():
    if len(sys.argv) < 2:
        print(json.dumps({
            "success": False,
            "error": "Audio file is required."
        }))
        sys.exit(1)

    audio_file = sys.argv[1]

    try:
        print("Loading Whisper model...", flush=True)

        model = whisper.load_model("tiny")

        print("Transcribing audio...", flush=True)

        result = model.transcribe(
            audio_file,
            fp16=False
        )

        transcript = result.get("text", "").strip()

        print(json.dumps({
            "success": True,
            "text": transcript
        }, ensure_ascii=False))

    except Exception as error:
        print(json.dumps({
            "success": False,
            "error": str(error)
        }, ensure_ascii=False))

        sys.exit(1)


if __name__ == "__main__":
    main()
