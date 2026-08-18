import axios from "axios";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();
const API_URL = "http://localhost:5000/api";
const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret_for_jwt";

async function runPhase11Tests() {
  console.log("==================================================");
  console.log("RUNNING PHASE 11 ADVANCED AI & CLINICAL INTELLIGENCE SUITE");
  console.log("==================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`✅ ${message}`);
      passed++;
    } else {
      console.error(`❌ FAILED: ${message}`);
      failed++;
    }
  }

  const runSuffix = Date.now().toString().slice(-4);

  // 1. Setup Test Users: Admin, Doctor, Patient A, Patient B
  const adminUser = await prisma.user.create({
    data: {
      email: `admin-ai-${runSuffix}@hospital.com`,
      passwordHash: "hashed",
      role: "ADMIN",
    },
  });
  const adminToken = jwt.sign({ id: adminUser.id, email: adminUser.email, role: "ADMIN" }, JWT_SECRET, { expiresIn: "1h" });

  const dept = await prisma.department.findFirst() || await prisma.department.create({
    data: { name: `Cardiology AI ${runSuffix}`, description: "Cardiovascular Care" }
  });

  const docUser = await prisma.user.create({
    data: {
      email: `doctor-ai-${runSuffix}@hospital.com`,
      passwordHash: "hashed",
      role: "DOCTOR",
    },
  });
  const doctor = await prisma.doctor.create({
    data: {
      userId: docUser.id,
      name: `Dr. AI Specialist ${runSuffix}`,
      specialization: "Internal Medicine",
      departmentId: dept.id,
      phone: `9988${runSuffix}`,
      email: docUser.email,
    },
  });
  const doctorToken = jwt.sign({ id: docUser.id, email: docUser.email, role: "DOCTOR", doctorId: doctor.id }, JWT_SECRET, { expiresIn: "1h" });

  const patAUser = await prisma.user.create({
    data: {
      email: `patient-ai-a-${runSuffix}@hospital.com`,
      passwordHash: "hashed",
      role: "PATIENT",
    },
  });
  const patientA = await prisma.patient.create({
    data: {
      userId: patAUser.id,
      name: `Alice AI ${runSuffix}`,
      phone: `8899${runSuffix}`,
      dob: new Date("1988-04-12"),
      gender: "FEMALE",
      bloodGroup: "A+",
      address: "123 Health Ave",
      allergies: "Penicillin",
    },
  });
  const patientAToken = jwt.sign({ id: patAUser.id, email: patAUser.email, role: "PATIENT", patientId: patientA.id }, JWT_SECRET, { expiresIn: "1h" });

  const patBUser = await prisma.user.create({
    data: {
      email: `patient-ai-b-${runSuffix}@hospital.com`,
      passwordHash: "hashed",
      role: "PATIENT",
    },
  });
  const patientB = await prisma.patient.create({
    data: {
      userId: patBUser.id,
      name: `Bob AI ${runSuffix}`,
      phone: `7788${runSuffix}`,
      dob: new Date("1992-09-20"),
      gender: "MALE",
      bloodGroup: "O+",
      address: "456 Wellness Blvd",
    },
  });
  const patientBToken = jwt.sign({ id: patBUser.id, email: patBUser.email, role: "PATIENT", patientId: patientB.id }, JWT_SECRET, { expiresIn: "1h" });

  // Create an appointment and vitals for Patient A
  const appA = await prisma.appointment.create({
    data: {
      patientId: patientA.id,
      doctorId: doctor.id,
      slotDateTime: new Date(Date.now() + 86400000),
      reason: "Post-operative check and hypertension management",
      status: "CONFIRMED",
      queueStatus: "IN_CONSULTATION",
    },
  });

  await prisma.vitals.create({
    data: {
      patientId: patientA.id,
      appointmentId: appA.id,
      bloodPressure: "126/82",
      pulse: 74,
      temperature: 98.4,
      spo2: 99,
      recordedBy: doctor.name,
    },
  });

  // ------------------------------------------------------------------
  // TEST 1: OCR File Type Validation
  // ------------------------------------------------------------------
  try {
    await axios.post(
      `${API_URL}/ai/ocr`,
      {
        fileData: "data:application/zip;base64,UEsDBBQAAAAIA...",
        fileName: "malicious.zip",
        fileType: "application/zip",
        documentCategory: "LAB_REPORT",
      },
      { headers: { Authorization: `Bearer ${doctorToken}` } }
    );
    assert(false, "TEST 1 FAILED: Unsupported file type should be rejected");
  } catch (err: any) {
    assert(err.response?.status === 400, "TEST 1 PASSED: Unsupported OCR file type rejected with HTTP 400 Bad Request");
  }

  // ------------------------------------------------------------------
  // TEST 2: OCR Extraction Response (Structured Draft & Disclaimer)
  // ------------------------------------------------------------------
  try {
    const dummyImageBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const res = await axios.post(
      `${API_URL}/ai/ocr`,
      {
        fileData: dummyImageBase64,
        fileName: "lab_report_hematology.png",
        fileType: "image/png",
        documentCategory: "LAB_REPORT",
      },
      { headers: { Authorization: `Bearer ${doctorToken}` } }
    );

    assert(
      res.status === 200 &&
      res.data.isDraft === true &&
      res.data.requiresConfirmation === true &&
      res.data.detectedDocumentType === "LABORATORY_REPORT" &&
      res.data.structuredFields?.testParameters?.length > 0,
      "TEST 2 PASSED: AI OCR extraction produced structured clinical draft with mandatory confirmation flag"
    );
  } catch (err: any) {
    assert(false, `TEST 2 FAILED: ${err.response?.data?.error || err.message}`);
  }

  // ------------------------------------------------------------------
  // TEST 3: AI Clinical Voice Transcription (Doctor Dictation)
  // ------------------------------------------------------------------
  try {
    const res = await axios.post(
      `${API_URL}/ai/voice-transcribe`,
      {
        dictationText: "Patient presented with 3-day history of productive cough and mild fever. Chest examination reveals bilateral clear breath sounds. Blood pressure 126/82. Prescribe oral amoxicillin and recommend 5 days rest.",
        patientId: patientA.id,
        appointmentId: appA.id,
      },
      { headers: { Authorization: `Bearer ${doctorToken}` } }
    );

    assert(
      res.status === 200 &&
      res.data.isDraft === true &&
      res.data.requiresDoctorReview === true &&
      Boolean(res.data.structuredClinicalNote?.chiefComplaints) &&
      Boolean(res.data.structuredClinicalNote?.recommendedPlan),
      "TEST 3 PASSED: Doctor clinical voice dictation produced structured editable clinical note"
    );
  } catch (err: any) {
    assert(false, `TEST 3 FAILED: ${err.response?.data?.error || err.message}`);
  }

  // ------------------------------------------------------------------
  // TEST 4: AI Safety - Patient Blocked from Clinician-Only Voice Transcribe
  // ------------------------------------------------------------------
  try {
    await axios.post(
      `${API_URL}/ai/voice-transcribe`,
      {
        dictationText: "Clinical notes testing",
      },
      { headers: { Authorization: `Bearer ${patientAToken}` } }
    );
    assert(false, "TEST 4 FAILED: Patient should not be allowed to invoke clinician voice transcription");
  } catch (err: any) {
    assert(err.response?.status === 403, "TEST 4 PASSED: Patient strictly blocked from clinician voice dictation with HTTP 403 Forbidden");
  }

  // ------------------------------------------------------------------
  // TEST 5: AI Safety - Patient Blocked from Clinical Suggestions & Helper
  // ------------------------------------------------------------------
  try {
    await axios.post(
      `${API_URL}/ai/suggestions`,
      { symptoms: "Severe chest pain" },
      { headers: { Authorization: `Bearer ${patientAToken}` } }
    );
    assert(false, "TEST 5 FAILED: Patient should not access clinician AI suggestions");
  } catch (err: any) {
    assert(err.response?.status === 403, "TEST 5 PASSED: Patient strictly blocked from clinician AI suggestions with HTTP 403 Forbidden");
  }

  // ------------------------------------------------------------------
  // TEST 6: AI Discharge Summary Generation (Synthesis from Patient EHR)
  // ------------------------------------------------------------------
  let dischargeDraftData: any = null;
  try {
    const res = await axios.post(
      `${API_URL}/ai/discharge-summary`,
      {
        patientId: patientA.id,
        appointmentId: appA.id,
      },
      { headers: { Authorization: `Bearer ${doctorToken}` } }
    );

    dischargeDraftData = res.data;
    assert(
      res.status === 200 &&
      res.data.status === "DRAFT" &&
      res.data.isDraft === true &&
      res.data.requiresDoctorSignature === true &&
      Boolean(res.data.primaryDiagnosis) &&
      Boolean(res.data.treatmentGiven) &&
      Boolean(res.data.followUpAdvice),
      "TEST 6 PASSED: AI synthesized comprehensive structured discharge summary draft from patient EHR"
    );
  } catch (err: any) {
    assert(false, `TEST 6 FAILED: ${err.response?.data?.error || err.message}`);
  }

  // ------------------------------------------------------------------
  // TEST 7: AI Safety - Patient Blocked from Unconfirmed Discharge Summary Draft Generation
  // ------------------------------------------------------------------
  try {
    await axios.post(
      `${API_URL}/ai/discharge-summary`,
      { patientId: patientA.id },
      { headers: { Authorization: `Bearer ${patientAToken}` } }
    );
    assert(false, "TEST 7 FAILED: Patient should not be allowed to draft discharge summaries");
  } catch (err: any) {
    assert(err.response?.status === 403, "TEST 7 PASSED: Patient blocked from generating unconfirmed discharge drafts with HTTP 403 Forbidden");
  }

  // ------------------------------------------------------------------
  // TEST 8: Doctor Confirms & Signs Official Discharge Summary
  // ------------------------------------------------------------------
  let confirmedSummaryNumber = "";
  try {
    const res = await axios.post(
      `${API_URL}/ai/discharge-summary/confirm`,
      {
        patientId: patientA.id,
        appointmentId: appA.id,
        admissionSummary: dischargeDraftData?.admissionSummary || "Patient completed follow-up consultation with stable hemodynamics.",
        primaryDiagnosis: "Essential Hypertension (Well-Controlled)",
        investigationsSummary: "Biochemical vitals and metabolic panel reviewed and within baseline limits.",
        treatmentGiven: "Maintenance antihypertensive therapy, lifestyle and dietary sodium counseling.",
        dischargeMedications: [
          { name: "Amlodipine", dosage: "5mg", frequency: "Once daily morning", duration: "30 days" },
          { name: "Metoprolol", dosage: "25mg", frequency: "Once daily morning", duration: "30 days" },
        ],
        followUpAdvice: "Continue daily BP monitoring. Return for cardiology checkup in 30 days.",
      },
      { headers: { Authorization: `Bearer ${doctorToken}` } }
    );

    confirmedSummaryNumber = res.data.dischargeSummary.summaryNumber;
    assert(
      res.status === 201 &&
      res.data.dischargeSummary.status === "CONFIRMED" &&
      Boolean(confirmedSummaryNumber) &&
      res.data.dischargeSummary.dischargeMedications.length === 2,
      `TEST 8 PASSED: Attending physician signed official discharge summary (${confirmedSummaryNumber})`
    );
  } catch (err: any) {
    assert(false, `TEST 8 FAILED: ${err.response?.data?.error || err.message}`);
  }

  // ------------------------------------------------------------------
  // TEST 9: Patient Access to Confirmed Discharge Summary
  // ------------------------------------------------------------------
  try {
    const res = await axios.get(
      `${API_URL}/ai/discharge-summary/patient/${patientA.id}`,
      { headers: { Authorization: `Bearer ${patientAToken}` } }
    );

    assert(
      res.status === 200 &&
      res.data.length > 0 &&
      res.data[0].summaryNumber === confirmedSummaryNumber &&
      res.data[0].status === "CONFIRMED",
      "TEST 9 PASSED: Patient A successfully retrieved own confirmed official discharge summary"
    );
  } catch (err: any) {
    assert(false, `TEST 9 FAILED: ${err.response?.data?.error || err.message}`);
  }

  // ------------------------------------------------------------------
  // TEST 10: IDOR Prevention on Discharge Summaries (Patient B blocked from Patient A)
  // ------------------------------------------------------------------
  try {
    await axios.get(
      `${API_URL}/ai/discharge-summary/patient/${patientA.id}`,
      { headers: { Authorization: `Bearer ${patientBToken}` } }
    );
    assert(false, "TEST 10 FAILED: Patient B should not access Patient A's discharge summary");
  } catch (err: any) {
    assert(err.response?.status === 403, "TEST 10 PASSED: Cross-patient discharge summary access strictly rejected with HTTP 403 Forbidden");
  }

  // ------------------------------------------------------------------
  // TEST 11: EHR Longitudinal Timeline Contains Confirmed Discharge Summary
  // ------------------------------------------------------------------
  try {
    const res = await axios.get(
      `${API_URL}/medical-records/timeline/${patientA.id}`,
      { headers: { Authorization: `Bearer ${patientAToken}` } }
    );

    const hasDischargeEvent = res.data.timeline?.some((ev: any) => ev.category === "DISCHARGE_SUMMARY");
    assert(
      res.status === 200 && hasDischargeEvent,
      "TEST 11 PASSED: Confirmed discharge summary seamlessly integrated into patient's longitudinal EHR timeline"
    );
  } catch (err: any) {
    assert(false, `TEST 11 FAILED: ${err.response?.data?.error || err.message}`);
  }

  // ------------------------------------------------------------------
  // TEST 12: AI Compliance Audit Trail Verification
  // ------------------------------------------------------------------
  try {
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        action: {
          in: [
            "AI_OCR_PROCESSED",
            "AI_VOICE_TRANSCRIBED",
            "AI_DISCHARGE_SUMMARY_GENERATED",
            "DISCHARGE_SUMMARY_CONFIRMED",
          ],
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    const ocrAudit = auditLogs.some((l) => l.action === "AI_OCR_PROCESSED");
    const voiceAudit = auditLogs.some((l) => l.action === "AI_VOICE_TRANSCRIBED");
    const draftAudit = auditLogs.some((l) => l.action === "AI_DISCHARGE_SUMMARY_GENERATED");
    const confirmAudit = auditLogs.some((l) => l.action === "DISCHARGE_SUMMARY_CONFIRMED");

    assert(
      ocrAudit && voiceAudit && draftAudit && confirmAudit,
      "TEST 12 PASSED: Security audit trail captured all AI operations (OCR, Voice, Draft, and Signed Confirmation)"
    );
  } catch (err: any) {
    assert(false, `TEST 12 FAILED: ${err.message}`);
  }

  console.log("==================================================");
  console.log(`RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase11Tests()
  .catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
