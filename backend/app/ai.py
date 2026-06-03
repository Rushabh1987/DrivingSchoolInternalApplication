import os

from openai import OpenAI

from .dashboard import get_dashboard_data

_MODEL = "nvidia/nemotron-3-super-120b-a12b:free"

_SYSTEM_INSIGHTS = (
    "You are a concise business analyst for a driving school. "
    "Output ONLY the final insights — no reasoning, no thinking, no preamble, no explanation. "
    "Just the plain sentences, one per line."
)

_SYSTEM_REMINDER = (
    "You are a concise assistant for a driving school. "
    "Output ONLY the final message text — no reasoning, no thinking, no preamble, no labels. "
    "Just the message, ready to send."
)


def _client() -> OpenAI:
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY environment variable is not set")
    return OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=api_key,
    )


def _clean(text: str) -> str:
    """Strip reasoning preamble and model-added labels from each line."""
    import re
    lines = []
    for line in text.strip().splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        lower = stripped.lower()
        # Skip lines that are clearly reasoning/preamble
        if any(lower.startswith(prefix) for prefix in (
            "we need", "we have", "let's", "let me", "so we", "here are",
            "example:", "output:", "insights:", "insight:",
        )):
            continue
        # Remove leading labels like "Line1:", "1.", "Insight 2:", "•", "-"
        stripped = re.sub(r"^(line\s*\d+[:.]?\s*|\d+[.)]\s*|insight\s*\d*[:.]?\s*|[-•]\s*)", "", stripped, flags=re.IGNORECASE).strip()
        if stripped and stripped[-1] in ".!?":
            lines.append(stripped)
    return "\n".join(lines[:3])


def generate_dashboard_insights() -> str:
    data = get_dashboard_data()
    counts = data["counts"]
    total = counts["totalStudents"]
    active = counts["activeStudents"]
    training_today = counts["todaysTraining"]
    pending_count = counts["pendingPayments"]
    pending_amount = counts["pendingPaymentAmount"]

    user_message = (
        f"Driving school data for today:\n"
        f"- Total students: {total}\n"
        f"- Active students: {active}\n"
        f"- Paused or completed students: {total - active}\n"
        f"- Training sessions today: {training_today}\n"
        f"- Students with pending fees: {pending_count}\n"
        f"- Total pending fees: Rs {pending_amount}\n\n"
        f"Write 2 or 3 actionable one-sentence insights for the admin. "
        f"Be specific and practical. One sentence per line. Nothing else."
    )

    client = _client()
    response = client.chat.completions.create(
        model=_MODEL,
        messages=[
            {"role": "system", "content": _SYSTEM_INSIGHTS},
            {"role": "user", "content": user_message},
        ],
        max_tokens=400,
        temperature=0.3,
    )
    raw = (response.choices[0].message.content or "").strip()
    return _clean(raw) or raw


def generate_payment_reminder(student_name: str, pending_amount: int) -> str:
    user_message = (
        f"Write a short, friendly WhatsApp message to a driving school student about their pending fees.\n"
        f"Student name: {student_name}\n"
        f"Pending amount: Rs {pending_amount}\n\n"
        f"Keep it under 3 sentences. Warm and professional. Just the message text, nothing else."
    )

    client = _client()
    response = client.chat.completions.create(
        model=_MODEL,
        messages=[
            {"role": "system", "content": _SYSTEM_REMINDER},
            {"role": "user", "content": user_message},
        ],
        max_tokens=150,
        temperature=0.5,
    )
    raw = (response.choices[0].message.content or "").strip()
    # Remove any leading label like "Message:" if the model adds one
    for prefix in ("message:", "reminder:", "text:"):
        if raw.lower().startswith(prefix):
            raw = raw[len(prefix):].strip()
            break
    return raw
