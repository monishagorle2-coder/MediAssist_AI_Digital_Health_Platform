import os
import json
import logging
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import google.generativeai as genai
from dotenv import load_dotenv

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ai-service")

load_dotenv()

# Configure Gemini API
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    logger.warning("GEMINI_API_KEY environment variable is not set. AI features will fail.")
else:
    genai.configure(api_key=api_key)

app = FastAPI(title="MediAssist AI Service", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic Schemas
class SuggestionsRequest(BaseModel):
    symptoms: str
    history: str

class SuggestionsResponse(BaseModel):
    clinicalSummary: str

# Endpoints

@app.post("/suggestions", response_model=SuggestionsResponse)
async def generate_suggestions(req: SuggestionsRequest):
    """
    Doctor AI - Clinical Summary Assistant
    Generates an objective clinical summary of patient symptoms and history.
    STRICT COMPLIANCE: Does NOT suggest diseases, conditions, or confidence scores.
    """
    if not api_key:
        raise HTTPException(status_code=500, detail="Gemini API Key is not configured on the server.")
    
    prompt = f"""
    You are an objective clinical documentation assistant for hospital physicians.
    Analyze the following patient presentation:
    Symptoms: {req.symptoms}
    Patient History: {req.history}

    Generate a structured JSON output with the following schema:
    {{
        "clinicalSummary": "A concise, objective clinical summary summarizing presented symptoms, timeline, reported severity, and key patient risk factors for physician review."
    }}

    STRICT COMPLIANCE RULES:
    - Return ONLY valid JSON matching the exact schema above.
    - Do NOT enclose in backticks or add markdown text.
    - You MUST NOT suggest any specific diseases, conditions, diagnoses, or differential diagnoses.
    - You MUST NOT include any confidence scores, percentages, or probability estimations.
    - Do NOT mention potential medical conditions. Limit output strictly to summarizing symptoms and reported presentation.
    """
    
    try:
        model = genai.GenerativeModel("gemini-1.5-flash")
        response = model.generate_content(prompt)
        text = response.text.strip()
        
        # Clean up any potential markdown code blocks
        if text.startswith("```json"):
            text = text[7:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()
        
        data = json.loads(text)
        return SuggestionsResponse(**data)
    except Exception as e:
        logger.error(f"Error calling Gemini: {e}")
        return SuggestionsResponse(
            clinicalSummary=f"Patient presentation: {req.symptoms}. Objective history: {req.history}. Attending physician should perform physical examination and clinical evaluation to determine final diagnosis."
        )

@app.post("/smart-appointment", response_model=SmartAppointmentResponse)
async def smart_appointment(req: SmartAppointmentRequest):
    """
    Smart Appointment Suggestion
    Suggests the appropriate hospital department based on symptoms.
    """
    if not api_key:
        raise HTTPException(status_code=500, detail="Gemini API Key is not configured.")
        
    deps_str = ", ".join(req.departments)
    prompt = f"""
    You are a hospital receptionist routing system. Based on the patient's symptoms, choose the most appropriate department from the following available list:
    Available Departments: [{deps_str}]
    
    Symptoms: {req.symptoms}
    
    Return a structured JSON output matching:
    {{
        "suggestedDepartment": "Department Name",
        "reasoning": "Brief explanation of why this department is suitable for these symptoms."
    }}
    
    Return ONLY valid JSON.
    """
    
    try:
        model = genai.GenerativeModel("gemini-1.5-flash")
        response = model.generate_content(prompt)
        text = response.text.strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()
        
        data = json.loads(text)
        return SmartAppointmentResponse(**data)
    except Exception as e:
        logger.error(f"Error: {e}")
        return SmartAppointmentResponse(
            suggestedDepartment=req.departments[0] if req.departments else "General Medicine",
            reasoning=f"Fallback routed to first department. (Error: {str(e)})"
        )

@app.post("/prescription-helper", response_model=PrescriptionHelperResponse)
async def prescription_helper(req: PrescriptionHelperRequest):
    """
    Prescription Helper
    Suggests common medicines and dosages based on a confirmed diagnosis.
    For doctor review only.
    """
    if not api_key:
        raise HTTPException(status_code=500, detail="Gemini API Key is not configured.")
        
    prompt = f"""
    You are a clinical pharmacologist. For the confirmed diagnosis of '{req.diagnosis}', suggest a list of common, standard medicines, along with their standard dosages, frequencies, and durations.
    These are suggestions for a doctor to review and edit.
    
    Return a structured JSON output matching:
    {{
        "suggestedMedicines": [
            {{
                "name": "Medicine Name",
                "dosage": "e.g., 500mg",
                "frequency": "e.g., Twice daily after meals",
                "duration": "e.g., 5 days"
            }}
        ]
    }}
    
    Return ONLY valid JSON.
    """
    
    try:
        model = genai.GenerativeModel("gemini-1.5-flash")
        response = model.generate_content(prompt)
        text = response.text.strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()
        
        data = json.loads(text)
        return PrescriptionHelperResponse(**data)
    except Exception as e:
        logger.error(f"Error: {e}")
        return PrescriptionHelperResponse(
            suggestedMedicines=[
                {"name": "Paracetamol", "dosage": "650mg", "frequency": "Thrice daily as needed", "duration": "3 days"},
                {"name": "ORSL", "dosage": "1 sachet", "frequency": "Mix in 1L water, drink throughout the day", "duration": "3 days"}
            ]
        )

@app.post("/medicine-prediction", response_model=MedicinePredictionResponse)
async def medicine_prediction(req: MedicinePredictionRequest):
    """
    Medicine Stock Prediction
    Predicts stock requirements for the next 30 days based on past metrics.
    """
    if not api_key:
        raise HTTPException(status_code=500, detail="Gemini API Key is not configured.")
        
    prompt = f"""
    You are an inventory planning AI for a hospital pharmacy. Analyze the stock levels and historical demand:
    Medicine: {req.medicine_name}
    Current Stock: {req.current_stock}
    Minimum stock safety limit: {req.min_limit}
    Dispensed in the last 30 days: {req.dispensed_last_30_days}
    
    Predict the demand for the next 30 days and provide a replenishment recommendation.
    
    Return a structured JSON matching:
    {{
        "predicted_demand_next_30_days": 45,
        "recommendation": "Order 50 units immediately to maintain safety stock.",
        "requires_restock": true
    }}
    
    Return ONLY valid JSON.
    """
    
    try:
        model = genai.GenerativeModel("gemini-1.5-flash")
        response = model.generate_content(prompt)
        text = response.text.strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()
        
        data = json.loads(text)
        return MedicinePredictionResponse(**data)
    except Exception as e:
        logger.error(f"Error: {e}")
        # Simple rule-based fallback
        predicted = int(req.dispensed_last_30_days * 1.1)
        requires = (req.current_stock - predicted) < req.min_limit
        rec = "Restock suggested to cover upcoming demand." if requires else "Stock levels are healthy."
        return MedicinePredictionResponse(
            predicted_demand_next_30_days=predicted,
            recommendation=rec,
            requires_restock=requires
        )

@app.post("/patient-summary", response_model=PatientSummaryResponse)
async def patient_summary(req: PatientSummaryRequest):
    """
    Patient-Friendly Diagnosis Summary
    Explains the confirmed diagnosis and treatment in simple, comforting language.
    Only triggered for patients after diagnosis is confirmed.
    """
    if not api_key:
        raise HTTPException(status_code=500, detail="Gemini API Key is not configured.")
        
    prompt = f"""
    Translate this clinical medical diagnosis and treatment plan into easy-to-understand, patient-friendly, and comforting language. 
    Avoid medical jargon. Keep it reassuring.
    
    Diagnosis: {req.diagnosis}
    Treatment: {req.treatment}
    
    Format: Return a paragraph of 3-4 sentences directly summarizing the condition, why the medicines help, and general recovery tips.
    Do NOT include confidence percentages, list other possible disease alternatives (differential diagnoses), or mention red flags.
    """
    
    try:
        model = genai.GenerativeModel("gemini-1.5-flash")
        response = model.generate_content(prompt)
        return PatientSummaryResponse(summary=response.text.strip())
    except Exception as e:
        logger.error(f"Error: {e}")
        return PatientSummaryResponse(
            summary=f"This is a patient-friendly summary of your diagnosis of {req.diagnosis}. Please follow your doctor's instructions carefully and complete your prescription course as prescribed."
        )

@app.post("/patient-chat")
async def patient_chat(req: PatientChatRequest):
    """
    Patient Chat - Restricted
    Provides general health information, tips, and medicine information.
    Absolutely NO symptom diagnosis, possible diseases, confidence scores, or red-flag alerts.
    """
    if not api_key:
        raise HTTPException(status_code=500, detail="Gemini API Key is not configured.")
        
    system_prompt = """
    You are the MediAssist Patient Health Assistant. 
    You are allowed to discuss general health information, wellness tips, basic medicine indications, and general healthy living practices.
    
    CRITICAL RESTRICTIONS:
    - You must NEVER attempt to diagnose the user's symptoms.
    - If the user shares symptoms, you must NEVER list potential diseases, diagnoses, confidence percentages, or suggest specific medical treatments.
    - You must NOT mention "red-flag warnings" or alarm the user.
    - If the user asks for a diagnosis or shares severe symptoms, state politely that you are an AI assistant who can only provide general health tips, and recommend they schedule an appointment with their doctor for clinical evaluation.
    - ALWAYS append the exact disclaimer: "Disclaimer: This is not a medical diagnosis. Please consult a qualified doctor for clinical guidance."
    """
    
    try:
        # Build chat history for Gemini
        history_formatted = []
        for h in req.history:
            role = "user" if h["role"] == "user" else "model"
            history_formatted.append({"role": role, "parts": [h["text"]]})
            
        model = genai.GenerativeModel("gemini-1.5-flash", system_instruction=system_prompt)
        chat = model.start_chat(history=history_formatted)
        response = chat.send_message(req.message)
        
        reply = response.text.strip()
        # Ensure disclaimer is included if model forgot it
        disclaimer = "Disclaimer: This is not a medical diagnosis. Please consult a qualified doctor for clinical guidance."
        if disclaimer not in reply:
            reply += f"\n\n{disclaimer}"
            
        return {"response": reply}
    except Exception as e:
        logger.error(f"Error: {e}")
        return {
            "response": "Hello, I am the general health tips assistant. I am currently running in offline mode. Please eat a balanced diet, exercise regularly, stay hydrated, and consult your doctor for any health concerns.\n\nDisclaimer: This is not a medical diagnosis. Please consult a qualified doctor for clinical guidance."
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main.py", host="0.0.0.0", port=8000, reload=True)
