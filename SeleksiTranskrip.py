import os
import json
import re
from typing import List, Dict

from google import genai
from google.genai import types


# ============================================================
# CONFIG
# ============================================================

MODEL_NAME = "gemini-2.5-flash"

TOP_N = 3

# API key bisa disimpan sebagai environment variable:
# Linux/macOS:
# export GEMINI_API_KEY="YOUR_API_KEY"
#
# Windows PowerShell:
# $env:GEMINI_API_KEY="YOUR_API_KEY"

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise RuntimeError(
        "GEMINI_API_KEY belum diset sebagai environment variable."
    )


client = genai.Client(api_key=GEMINI_API_KEY)


# ============================================================
# PROMPT
# ============================================================

SYSTEM_PROMPT = """
You are an expert viral short-form video editor and content strategist.

Your job is to analyze a video transcript and identify the strongest
potential viral clips.

Do NOT simply select generic interesting moments.

Evaluate clips using these virality dimensions:

1. HOOK
   - Does the opening immediately create curiosity?
   - Is there a surprising statement, question, claim, or tension?

2. EMOTIONAL PEAK
   - Strong emotion
   - Surprise
   - Fear
   - Humor
   - Excitement
   - Anger
   - Inspiration

3. OPINION BOMB
   - Strong opinion
   - Contrarian statement
   - Controversial claim
   - Something people may disagree with

4. REVELATION
   - New information
   - Unexpected fact
   - Myth-busting
   - "I didn't know that" moment

5. CONFLICT
   - Debate
   - Disagreement
   - Tension
   - Challenging common beliefs

6. QUOTABLE LINE
   - A sentence that can stand alone
   - Memorable
   - Easy to quote or repost

7. STORY PEAK
   - Important moment in a story
   - Punchline
   - Turning point
   - Payoff

8. PRACTICAL VALUE
   - Useful information
   - Advice
   - Actionable knowledge
   - Answer to a common question

A good viral clip should ideally have:
- a strong opening
- clear context
- a payoff
- emotional or intellectual tension
- enough information to make sense without the entire video

Avoid clips that:
- start too slowly
- require too much previous context
- contain incomplete sentences
- are mostly greetings/introduction
- are repetitive
- have no clear payoff

IMPORTANT:

The transcript timestamps represent the original video timeline.

You must return timestamps for every selected clip.

The clip should normally be between 15 and 90 seconds.

If necessary, include a few seconds before the strongest sentence to create
a better hook/context.

Score every candidate from 0-100.

The final viral score should reflect the likelihood that the clip will:
- stop scrolling
- retain viewers
- generate comments
- generate shares
- generate saves
- create curiosity
- provide value

Return ONLY valid JSON.
Do not include markdown.
"""


# ============================================================
# HELPERS
# ============================================================

def extract_timestamp(line: str):
    """
    Extract timestamp from:

    [00:24] Some text

    Returns seconds + text.
    """

    match = re.match(r"\[(\d{2}):(\d{2})\]\s*(.*)", line)

    if not match:
        return None

    minutes = int(match.group(1))
    seconds = int(match.group(2))

    total_seconds = minutes * 60 + seconds

    return total_seconds, match.group(3)


def timestamp_to_seconds(timestamp: str) -> float:
    """
    Convert:

    01:24

    to:

    84 seconds
    """

    parts = timestamp.split(":")

    if len(parts) != 2:
        raise ValueError(f"Invalid timestamp: {timestamp}")

    return int(parts[0]) * 60 + int(parts[1])


def seconds_to_timestamp(seconds: float) -> str:
    """
    Convert seconds to MM:SS.
    """

    seconds = max(0, int(seconds))

    minutes = seconds // 60
    seconds = seconds % 60

    return f"{minutes:02d}:{seconds:02d}"


def normalize_transcript(transcript: str) -> str:
    """
    Normalize transcript while preserving timestamps.
    """

    lines = []

    for line in transcript.splitlines():

        line = line.strip()

        if not line:
            continue

        parsed = extract_timestamp(line)

        if parsed:
            seconds, text = parsed

            timestamp = seconds_to_timestamp(seconds)

            lines.append(
                f"[{timestamp}] {text.strip()}"
            )

        else:
            # Keep lines without timestamps if needed
            lines.append(line)

    return "\n".join(lines)


# ============================================================
# GEMINI ANALYSIS
# ============================================================

def analyze_transcript(
    transcript: str,
    top_n: int = TOP_N
) -> Dict:

    transcript = normalize_transcript(transcript)

    prompt = f"""
Analyze the following video transcript.

Select the TOP {top_n} strongest potential viral clips.

Transcript:

-------------------------
{transcript}
-------------------------

For each selected clip return:

- rank
- viral_score
- start_time
- end_time
- duration_seconds
- hook
- title
- summary
- why_viral
- category
- strengths
- weaknesses

The "category" can contain one or more of:

HOOK
EMOTIONAL_PEAK
OPINION_BOMB
REVELATION
CONFLICT
QUOTABLE_LINE
STORY_PEAK
PRACTICAL_VALUE

The "strengths" field should explain which viral dimensions make
the clip strong.

The "weaknesses" field should explain any potential problems.

Also return an overall summary explaining why these clips were selected.

Use this exact JSON structure:

{{
    "overall_summary": "...",
    "clips": [
        {{
            "rank": 1,
            "viral_score": 95,
            "start_time": "00:30",
            "end_time": "01:15",
            "duration_seconds": 45,
            "title": "...",
            "hook": "...",
            "summary": "...",
            "why_viral": "...",
            "category": [
                "HOOK",
                "PRACTICAL_VALUE"
            ],
            "strengths": [
                "...",
                "..."
            ],
            "weaknesses": [
                "..."
            ]
        }}
    ]
}}
"""

    response = client.models.generate_content(
        model=MODEL_NAME,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            temperature=0.2,
            response_mime_type="application/json",
        )
    )

    result = json.loads(response.text)

    return result


# ============================================================
# VALIDATION
# ============================================================

def validate_clips(result: Dict):

    if "clips" not in result:
        raise ValueError(
            "Response Gemini tidak memiliki field 'clips'."
        )

    for clip in result["clips"]:

        required_fields = [
            "rank",
            "viral_score",
            "start_time",
            "end_time",
            "duration_seconds",
            "title",
            "hook",
            "summary",
            "why_viral",
            "category",
        ]

        for field in required_fields:

            if field not in clip:
                raise ValueError(
                    f"Field '{field}' tidak ditemukan."
                )

        score = clip["viral_score"]

        if not 0 <= score <= 100:
            raise ValueError(
                f"Viral score tidak valid: {score}"
            )

        start = timestamp_to_seconds(
            clip["start_time"]
        )

        end = timestamp_to_seconds(
            clip["end_time"]
        )

        if end <= start:
            raise ValueError(
                f"Timestamp invalid: "
                f"{clip['start_time']} -> {clip['end_time']}"
            )

        clip["duration_seconds"] = end - start


# ============================================================
# DISPLAY
# ============================================================

def print_results(result: Dict):

    print("\n")
    print("=" * 70)
    print("VIRAL CLIP ANALYSIS")
    print("=" * 70)

    print("\nRANGKUMAN:")
    print(result["overall_summary"])

    print("\n")

    for clip in result["clips"]:

        print("=" * 70)

        print(
            f"#{clip['rank']} "
            f"| VIRAL SCORE: {clip['viral_score']}/100"
        )

        print(
            f"TIME: "
            f"{clip['start_time']} -> {clip['end_time']} "
            f"({clip['duration_seconds']}s)"
        )

        print(f"\nTITLE:")
        print(clip["title"])

        print(f"\nHOOK:")
        print(clip["hook"])

        print(f"\nSUMMARY:")
        print(clip["summary"])

        print(f"\nWHY VIRAL:")
        print(clip["why_viral"])

        print(f"\nCATEGORY:")
        print(", ".join(clip["category"]))

        print(f"\nSTRENGTHS:")

        for strength in clip["strengths"]:
            print(f"- {strength}")

        print(f"\nWEAKNESSES:")

        for weakness in clip["weaknesses"]:
            print(f"- {weakness}")

        print()


# ============================================================
# MAIN
# ============================================================

def main():

    print("Masukkan transcript.")
    print("Ketik END pada baris terakhir.")
    print()

    lines = []

    while True:

        line = input()

        if line.strip() == "END":
            break

        lines.append(line)

    transcript = "\n".join(lines)

    if not transcript.strip():
        print("Transcript kosong.")
        return

    print("\nMenganalisis transcript dengan Gemini...\n")

    result = analyze_transcript(
        transcript,
        top_n=TOP_N
    )

    validate_clips(result)

    print_results(result)

    # Simpan hasil untuk pipeline berikutnya
    with open(
        "viral_clips.json",
        "w",
        encoding="utf-8"
    ) as f:

        json.dump(
            result,
            f,
            ensure_ascii=False,
            indent=2
        )

    print("\nHasil disimpan ke: viral_clips.json")


if __name__ == "__main__":
    main()