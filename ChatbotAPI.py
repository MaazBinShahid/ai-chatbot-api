import os
import re
from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from openai import OpenAI

# ---------------------------
# Load environment
# ---------------------------
load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# ---------------------------
# FastAPI setup
# ---------------------------
app = FastAPI()

# Explicit CORS for ngrok/browser
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For testing; restrict in production
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# ---------------------------
# Pydantic model
# ---------------------------
class ChatQuery(BaseModel):
    query: str
    session_id: str = "default"
    role: str | None = "user"   # 👈 added role with default

# ---------------------------
# Session memory
# ---------------------------
sessions = {}
MAX_HISTORY = 10  # Limit chat history to last 10 messages

def get_session(session_id: str):
    if session_id not in sessions:
        sessions[session_id] = {
            "chat_history": [],
            "vehicle_info": None  # store {"make_model", "size"}
        }
    return sessions[session_id]

# ---------------------------
# Load Knowledge Base
# ---------------------------
def load_kb():
    kb_dir = "./kb"
    text_blocks = []
    for fname in os.listdir(kb_dir):
        if fname.endswith(".md"):
            with open(os.path.join(kb_dir, fname), "r", encoding="utf-8") as f:
                text_blocks.append(f.read())
    return "\n\n".join(text_blocks)

kb_content = load_kb()

# ---------------------------
# Load vehicle sizes
# ---------------------------
def load_vehicle_sizes(file_path="./kb/vehicle_sizes.md"):
    categories = {}
    current_category = None
    with open(file_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line.startswith("- **") and line.endswith("**:"):
                current_category = re.sub(r"[-*:]", "", line).strip()
                categories[current_category] = []
            elif line and current_category:
                vehicles = [v.strip() for v in line.split(",")]
                categories[current_category].extend(vehicles)
    return categories

VEHICLE_SIZES = load_vehicle_sizes()

def detect_vehicle_info(user_text: str):
    text = user_text.lower()
    for category, vehicles in VEHICLE_SIZES.items():
        for v in vehicles:
            if v.lower() in text:
                return {"make_model": v, "size": category}
    return None

# ---------------------------
# System Prompt
# ---------------------------
system_prompt = f"""
You are working as Help Center AI Assistance for Keen Eyes Detailing.
Behave politely, be versatile, and don't let users know you are AI.
Use the following knowledge base to answer questions:

{kb_content}

Follow these rules at ALL times:
1. NEVER provide pricing without first asking the vehicle make, model, and variant.  
2. Use `vehicle_sizes.md` to map the vehicle to a category.  
3. Then use `packages.md` to return the correct package and pricing.  
4. If the user refuses to give their vehicle make/model, always assume a Sedan (small car) and provide the Sedan pricing from packages.md.  
5. If asked for “general pricing”, ONLY mention Sedan base pricing, not full packages.  
6. If the question is outside detailing, politely redirect to our support phone number.
"""

# ---------------------------
# Chat Endpoint
# ---------------------------
@app.post("/chat")
async def chat(data: ChatQuery):
    session = get_session(data.session_id)
    chat_history = session["chat_history"]
    question = data.query

    print(data)
    role = data.role or "user"   # ✅ use attribute, not .get()

    if not question:
        return {"answer": "⚠️ I didn’t receive a question."}

    # Add user message
    chat_history.append({"role": "user", "content": question})


    # 🚫 If the role is assistant (bot greeting), don’t call OpenAI
    if role == "assistant":
        return {"answer": None, "status": "greeting_saved"}

    # Limit history
    if len(chat_history) > MAX_HISTORY:
        chat_history = chat_history[-MAX_HISTORY:]
        session["chat_history"] = chat_history

    # Detect vehicle info dynamically
    vehicle_info = detect_vehicle_info(question)
    if vehicle_info:
        session["vehicle_info"] = vehicle_info

    # Inject vehicle info into system prompt
    context_note = ""
    if session["vehicle_info"]:
        vi = session["vehicle_info"]
        context_note = f"The user’s vehicle is {vi['make_model']} ({vi['size']})."

    messages = [{"role": "system", "content": system_prompt + "\n" + context_note}] + chat_history

    # Call OpenAI
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            temperature=0.2,
        )
        answer = response.choices[0].message.content.strip()
    except Exception as e:
        return {"answer": f"❌ OpenAI error: {e}"}

    # Save assistant reply
    chat_history.append({"role": "assistant", "content": answer})

    return {"answer": answer}
