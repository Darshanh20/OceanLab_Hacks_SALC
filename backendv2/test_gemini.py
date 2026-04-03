import os
from dotenv import load_dotenv
load_dotenv("d:/SALC/backend/.env")

import google.generativeai as genai

key = os.getenv("GEMINI_API_KEY")
print(f"Key starts with: {key[:10]}...")

genai.configure(api_key=key)

# Test 1: Embedding
try:
    result = genai.embed_content(
        model="models/text-embedding-004",
        content="Hello world test",
        task_type="retrieval_document",
    )
    print(f"text-embedding-004 works! Dimension: {len(result['embedding'])}")
except Exception as e:
    print(f"text-embedding-004 failed: {e}")

# Test 2: Try embedding-001 as fallback
try:
    result = genai.embed_content(
        model="models/embedding-001",
        content="Hello world test",
        task_type="retrieval_document",
    )
    print(f"embedding-001 works! Dimension: {len(result['embedding'])}")
except Exception as e:
    print(f"embedding-001 failed: {e}")

# Test 3: Text generation
try:
    model = genai.GenerativeModel("gemini-2.0-flash")
    response = model.generate_content("Say hello in one word")
    print(f"gemini-2.0-flash works! Response: {response.text.strip()}")
except Exception as e:
    print(f"gemini-2.0-flash failed: {e}")
