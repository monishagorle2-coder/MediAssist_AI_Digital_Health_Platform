import axios from "axios";
import prisma from "../src/db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const API_BASE = "http://localhost:5000/api";
const JWT_SECRET = process.env.JWT_SECRET || "mediassist_super_secret_jwt_key_12345";

async function runPhase8Tests() {
  console.log("==================================================");
  console.log("RUNNING PHASE 8 MEDICAL RECORDS & DOCUMENT ENGINE SUITE");
  console.log("==================================================");

  const passwordHash = await bcrypt.hash("Password123!", 10);
  const runSuffix = Date.now().toString().slice(-4);

  // Setup Patient A User
  const patAUser = await prisma.user.upsert({
    where: { email: `patientA.phase8.${runSuffix}@hospital.com` },
    update: {},
    create: { email: `patientA.phase8.${runSuffix}@hospital.com`, passwordHash, role: "PATIENT" },
  });

  const patientA = await prisma.patient.upsert({
    where: { userId: patAUser.id },
    update: {},
    create: {
      userId: patAUser.id,
      name: "Arthur Dent " + runSuffix,
      phone: "9988334411",
      dob: new Date("1985-03-11"),
      gender: "Male",
      bloodGroup: "O+",
      address: "42 Galaxy Way",
      allergies: "Penicillin",
      chronicConditions: "Mild Asthma",
      emergencyContactName: "Tricia McMillan",
      emergencyContactPhone: "9988334499",
      insuranceProvider: "Galactic HealthCare",
      insuranceNumber: "GHC-998822",
    },
  });

  // Setup Patient B User (for security isolation checks)
  const patBUser = await prisma.user.upsert({
    where: { email: `patientB.phase8.${runSuffix}@hospital.com` },
    update: {},
    create: { email: `patientB.phase8.${runSuffix}@hospital.com`, passwordHash, role: "PATIENT" },
  });

  const patientB = await prisma.patient.upsert({
    where: { userId: patBUser.id },
    update: {},
    create: {
      userId: patBUser.id,
      name: "Ford Prefect " + runSuffix,
      phone: "9988334422",
      dob: new Date("1982-08-20"),
      gender: "Male",
      bloodGroup: "AB+",
      address: "100 Betelgeuse",
    },
  });

  // Setup Doctor User
  const docUser = await prisma.user.upsert({
    where: { email: `doctor.phase8.${runSuffix}@hospital.com` },
    update: {},
    create: { email: `doctor.phase8.${runSuffix}@hospital.com`, passwordHash, role: "DOCTOR" },
  });

  let dept = await prisma.department.findFirst();
  if (!dept) {
    dept = await prisma.department.create({
      data: { name: "Cardiology " + runSuffix, description: "Cardiovascular Medicine" },
    });
  }

  const doctor = await prisma.doctor.upsert({
    where: { userId: docUser.id },
    update: {},
    create: {
      userId: docUser.id,
      name: "Dr. Stephen Strange " + runSuffix,
      specialization: "Cardiology",
      departmentId: dept.id,
      phone: "9988334433",
      email: docUser.email,
    },
  });

  // Setup Lab Technician & Receptionist
  const labTechUser = await prisma.user.upsert({
    where: { email: `labtech.phase8.${runSuffix}@hospital.com` },
    update: {},
    create: { email: `labtech.phase8.${runSuffix}@hospital.com`, passwordHash, role: "LAB_TECHNICIAN" },
  });

  const recUser = await prisma.user.upsert({
    where: { email: `receptionist.phase8.${runSuffix}@hospital.com` },
    update: {},
    create: { email: `receptionist.phase8.${runSuffix}@hospital.com`, passwordHash, role: "RECEPTIONIST" },
  });

  // Tokens
  const patAToken = jwt.sign({ id: patAUser.id, email: patAUser.email, role: "PATIENT", patientId: patientA.id }, JWT_SECRET, { expiresIn: "1h" });
  const patBToken = jwt.sign({ id: patBUser.id, email: patBUser.email, role: "PATIENT", patientId: patientB.id }, JWT_SECRET, { expiresIn: "1h" });
  const docToken = jwt.sign({ id: docUser.id, email: docUser.email, role: "DOCTOR", doctorId: doctor.id }, JWT_SECRET, { expiresIn: "1h" });
  const labTechToken = jwt.sign({ id: labTechUser.id, email: labTechUser.email, role: "LAB_TECHNICIAN" }, JWT_SECRET, { expiresIn: "1h" });
  const recToken = jwt.sign({ id: recUser.id, email: recUser.email, role: "RECEPTIONIST" }, JWT_SECRET, { expiresIn: "1h" });

  const patAClient = axios.create({ baseURL: API_BASE, headers: { Authorization: `Bearer ${patAToken}` } });
  const patBClient = axios.create({ baseURL: API_BASE, headers: { Authorization: `Bearer ${patBToken}` } });
  const docClient = axios.create({ baseURL: API_BASE, headers: { Authorization: `Bearer ${docToken}` } });
  const labTechClient = axios.create({ baseURL: API_BASE, headers: { Authorization: `Bearer ${labTechToken}` } });
  const recClient = axios.create({ baseURL: API_BASE, headers: { Authorization: `Bearer ${recToken}` } });

  let testPassed = 0;
  let testFailed = 0;

  // Create Patient Clinical Journey Data for testing
  let appointmentId = "";
  let diagnosisRecordId = "";
  let prescriptionId = "";
  let labOrderId = "";
  let billId = "";

  // Step A: Appointment & Vitals
  try {
    const appRes = await recClient.post("/appointments", {
      patientId: patientA.id,
      doctorId: doctor.id,
      slotDateTime: new Date("2026-11-23T10:00:00.000Z").toISOString(),
      reason: "Hypertension follow-up and chest tightness evaluation",
    });
    appointmentId = appRes.data.id;

    // Check-in
    await recClient.post(`/appointments/${appointmentId}/check-in`);

    // Record Vitals
    await docClient.post(`/patients/${patientA.id}/vitals`, {
      appointmentId,
      bloodPressure: "135/85",
      pulse: 78,
      temperature: 98.7,
      spo2: 99,
      weight: 74,
      height: 178,
    });

    // Step B: Diagnosis
    const diagRes = await docClient.post("/diagnosis", {
      appointmentId,
      patientId: patientA.id,
      symptoms: "Exertional dyspnea, mild intermittent chest tightness",
    });
    diagnosisRecordId = diagRes.data.id;

    // Confirm Diagnosis
    await docClient.put(`/diagnosis/${diagnosisRecordId}/confirm`, {
      finalDiagnosis: "Stage 1 Essential Hypertension with Exertional Angina",
    });

    // Step C: Prescription
    const prescRes = await docClient.post("/pharmacy/prescriptions", {
      appointmentId,
      patientId: patientA.id,
      diagnosisRecordId,
      medicines: [
        { medicineName: "Amlodipine 5mg", dosage: "5mg", frequency: "OD", duration: "30 days", quantity: 30, instructions: "Take in the morning" },
        { medicineName: "Aspirin 75mg", dosage: "75mg", frequency: "OD", duration: "30 days", quantity: 30, instructions: "Take after breakfast" },
      ],
      notes: "Low sodium DASH diet, regular BP tracking daily.",
    });
    prescriptionId = prescRes.data.id;

    // Step D: Lab Order & Results
    let labTest = await prisma.labTest.findFirst({ where: { code: "LIPID" } });
    if (!labTest) {
      labTest = await prisma.labTest.create({
        data: {
          name: "Lipid Profile Comprehensive",
          code: "LIPID",
          category: "Biochemistry",
          sampleType: "Fasting Serum",
          price: 65,
          tatHours: 12,
          referenceRange: "Total Cholesterol < 200 mg/dL",
          unit: "mg/dL",
          isActive: true,
        },
      });
    }

    const labOrderRes = await docClient.post("/lab/orders", {
      patientId: patientA.id,
      doctorId: doctor.id,
      appointmentId,
      labTestId: labTest.id,
      priority: "ROUTINE",
      clinicalNotes: "Fasting 12 hours required. Rule out hyperlipidemia.",
    });
    labOrderId = labOrderRes.data.id;

    // Collect Sample
    await labTechClient.put(`/lab/orders/${labOrderId}/sample`);

    // Enter Lab Results
    await labTechClient.post(`/lab/orders/${labOrderId}/results`, {
      parameterResults: [
        { parameter: "Total Cholesterol", value: "215", unit: "mg/dL", referenceRange: "< 200", flag: "HIGH" },
        { parameter: "HDL Cholesterol", value: "48", unit: "mg/dL", referenceRange: "> 40", flag: "NORMAL" },
        { parameter: "LDL Cholesterol", value: "138", unit: "mg/dL", referenceRange: "< 100", flag: "HIGH" },
        { parameter: "Triglycerides", value: "145", unit: "mg/dL", referenceRange: "< 150", flag: "NORMAL" },
      ],
      summary: "Borderline hypercholesterolemia with elevated LDL fraction.",
      remarks: "Recommend dietary lifestyle modification and statin evaluation.",
      approvedBy: "Dr. Emily Stone, MD (Chief Pathologist)",
    });

    // Step E: Billing
    const bill = await prisma.bill.findFirst({ where: { patientId: patientA.id } });
    billId = bill?.id || "";
  } catch (err: any) {
    console.error("Setup error:", err.response?.data || err.message);
  }

  // 1. Test 1: Patient Longitudinal EHR Timeline Retrieval
  try {
    const timelineRes = await patAClient.get(`/medical-records/timeline/${patientA.id}`);
    const data = timelineRes.data;

    if (
      timelineRes.status === 200 &&
      data.patient?.id === patientA.id &&
      Array.isArray(data.timeline) &&
      data.timeline.length >= 4 &&
      data.summaryStats
    ) {
      console.log(`✅ TEST 1 PASSED: Retrieved longitudinal medical timeline for Patient A with ${data.timeline.length} unified EHR events`);
      testPassed++;
    } else {
      console.error("❌ TEST 1 FAILED: Invalid timeline payload", data);
      testFailed++;
    }
  } catch (err: any) {
    console.error("❌ TEST 1 FAILED:", err.response?.data || err.message);
    testFailed++;
  }

  // 2. Test 2: Timeline Ownership Isolation (Patient B cannot access Patient A's timeline)
  try {
    await patBClient.get(`/medical-records/timeline/${patientA.id}`);
    console.error("❌ TEST 2 FAILED: Patient B was allowed to view Patient A's medical timeline!");
    testFailed++;
  } catch (err: any) {
    if (err.response?.status === 403) {
      console.log("✅ TEST 2 PASSED: Cross-patient timeline request rejected with HTTP 403 Forbidden");
      testPassed++;
    } else {
      console.error(`❌ TEST 2 FAILED: Expected 403, got ${err.response?.status}`);
      testFailed++;
    }
  }

  // 3. Test 3: Doctor Authorized Access to Patient EHR Timeline
  try {
    const docTimelineRes = await docClient.get(`/medical-records/timeline/${patientA.id}`);
    if (docTimelineRes.status === 200 && docTimelineRes.data.patient.id === patientA.id) {
      console.log("✅ TEST 3 PASSED: Attending Physician successfully accessed Patient A's clinical timeline");
      testPassed++;
    } else {
      console.error("❌ TEST 3 FAILED: Doctor timeline fetch failed", docTimelineRes.data);
      testFailed++;
    }
  } catch (err: any) {
    console.error("❌ TEST 3 FAILED:", err.response?.data || err.message);
    testFailed++;
  }

  // 4. Test 4: Diagnosis Report Document Endpoint & Completeness
  try {
    const diagDocRes = await patAClient.get(`/medical-records/diagnosis/${diagnosisRecordId}/report`);
    const doc = diagDocRes.data;

    if (
      diagDocRes.status === 200 &&
      doc.documentType === "CLINICAL_DIAGNOSIS_REPORT" &&
      doc.patient?.name === patientA.name &&
      doc.clinicalFindings?.finalDiagnosis.includes("Hypertension") &&
      doc.vitals?.bloodPressure === "135/85" &&
      doc.hospital?.accreditation
    ) {
      console.log("✅ TEST 4 PASSED: Generated complete clinical diagnosis document with hospital branding, vitals, and physician confirmation");
      testPassed++;
    } else {
      console.error("❌ TEST 4 FAILED: Incomplete diagnosis report", doc);
      testFailed++;
    }
  } catch (err: any) {
    console.error("❌ TEST 4 FAILED:", err.response?.data || err.message);
    testFailed++;
  }

  // 5. Test 5: Diagnosis Report Security (Patient B blocked from Patient A's diagnosis)
  try {
    await patBClient.get(`/medical-records/diagnosis/${diagnosisRecordId}/report`);
    console.error("❌ TEST 5 FAILED: Patient B accessed Patient A's diagnosis report!");
    testFailed++;
  } catch (err: any) {
    if (err.response?.status === 403) {
      console.log("✅ TEST 5 PASSED: Cross-patient diagnosis report access rejected with HTTP 403 Forbidden");
      testPassed++;
    } else {
      console.error(`❌ TEST 5 FAILED: Expected 403, got ${err.response?.status}`);
      testFailed++;
    }
  }

  // 6. Test 6: Prescription Report Document Endpoint & Completeness
  try {
    const rxDocRes = await patAClient.get(`/medical-records/prescription/${prescriptionId}/report`);
    const doc = rxDocRes.data;

    if (
      rxDocRes.status === 200 &&
      doc.documentType === "PRESCRIPTION_ORDER" &&
      Array.isArray(doc.medicines) &&
      doc.medicines.length === 2 &&
      doc.medicines[0].medicineName.includes("Amlodipine")
    ) {
      console.log(`✅ TEST 6 PASSED: Generated formal prescription document (${doc.rxNumber}) with ${doc.medicines.length} medications and clinical instructions`);
      testPassed++;
    } else {
      console.error("❌ TEST 6 FAILED: Invalid prescription document", doc);
      testFailed++;
    }
  } catch (err: any) {
    console.error("❌ TEST 6 FAILED:", err.response?.data || err.message);
    testFailed++;
  }

  // 7. Test 7: Prescription Report Security (Patient B blocked from Patient A's prescription)
  try {
    await patBClient.get(`/medical-records/prescription/${prescriptionId}/report`);
    console.error("❌ TEST 7 FAILED: Patient B accessed Patient A's prescription!");
    testFailed++;
  } catch (err: any) {
    if (err.response?.status === 403) {
      console.log("✅ TEST 7 PASSED: Cross-patient prescription access rejected with HTTP 403 Forbidden");
      testPassed++;
    } else {
      console.error(`❌ TEST 7 FAILED: Expected 403, got ${err.response?.status}`);
      testFailed++;
    }
  }

  // 8. Test 8: Laboratory Diagnostic Report Document Endpoint & Clinical Flags
  try {
    const labDocRes = await patAClient.get(`/medical-records/lab/${labOrderId}/report`);
    const doc = labDocRes.data;

    if (
      labDocRes.status === 200 &&
      doc.documentType === "LABORATORY_DIAGNOSTIC_REPORT" &&
      doc.orderNumber &&
      Array.isArray(doc.result?.parameters) &&
      doc.result.parameters.some((p: any) => p.flag === "HIGH") &&
      doc.result.approvedBy.includes("Emily Stone")
    ) {
      console.log("✅ TEST 8 PASSED: Generated formal laboratory report with parameter results, abnormal flags (HIGH), and pathologist approval stamp");
      testPassed++;
    } else {
      console.error("❌ TEST 8 FAILED: Incomplete laboratory report document", doc);
      testFailed++;
    }
  } catch (err: any) {
    console.error("❌ TEST 8 FAILED:", err.response?.data || err.message);
    testFailed++;
  }

  // 9. Test 9: Laboratory Report Security (Patient B blocked from Patient A's lab report)
  try {
    await patBClient.get(`/medical-records/lab/${labOrderId}/report`);
    console.error("❌ TEST 9 FAILED: Patient B accessed Patient A's lab report!");
    testFailed++;
  } catch (err: any) {
    if (err.response?.status === 403) {
      console.log("✅ TEST 9 PASSED: Cross-patient lab report access rejected with HTTP 403 Forbidden");
      testPassed++;
    } else {
      console.error(`❌ TEST 9 FAILED: Expected 403, got ${err.response?.status}`);
      testFailed++;
    }
  }

  // 10. Test 10: Formal Hospital Invoice / Receipt Document Endpoint & Security
  try {
    if (billId) {
      const invoiceRes = await patAClient.get(`/bills/${billId}/invoice`);
      const doc = invoiceRes.data;

      if (
        invoiceRes.status === 200 &&
        doc.invoiceNumber &&
        doc.totalAmount > 0 &&
        doc.hospital?.name
      ) {
        console.log(`✅ TEST 10 PASSED: Generated formal hospital invoice document #${doc.invoiceNumber} ($${doc.totalAmount.toFixed(2)})`);
        testPassed++;
      } else {
        console.error("❌ TEST 10 FAILED: Invalid invoice document", doc);
        testFailed++;
      }

      // Check cross-patient security on invoice
      try {
        await patBClient.get(`/bills/${billId}/invoice`);
        console.error("❌ TEST 10 FAILED: Patient B accessed Patient A's invoice!");
        testFailed++;
      } catch (secErr: any) {
        if (secErr.response?.status === 403) {
          console.log("✅ TEST 10 (Security) PASSED: Cross-patient invoice access rejected with HTTP 403 Forbidden");
        }
      }
    } else {
      console.log("⚠️ TEST 10 SKIPPED: No bill record found");
    }
  } catch (err: any) {
    console.error("❌ TEST 10 FAILED:", err.response?.data || err.message);
    testFailed++;
  }

  console.log("==================================================");
  console.log(`RESULTS: ${testPassed} Passed, ${testFailed} Failed`);
  console.log("==================================================");

  if (testFailed > 0) {
    process.exit(1);
  }
}

runPhase8Tests().catch((e) => {
  console.error("Fatal Test Error:", e);
  process.exit(1);
});
