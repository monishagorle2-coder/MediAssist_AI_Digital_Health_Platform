import axios from "axios";
import prisma from "../src/db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const API_BASE = "http://localhost:5000/api";
const JWT_SECRET = process.env.JWT_SECRET || "mediassist_super_secret_jwt_key_12345";

async function runPhase5Tests() {
  console.log("==================================================");
  console.log("RUNNING PHASE 5 LABORATORY & DIAGNOSTICS SUITE");
  console.log("==================================================");

  const passwordHash = await bcrypt.hash("Password123!", 10);
  const runSuffix = Date.now().toString().slice(-4);

  // Setup Lab Tech
  const techUser = await prisma.user.upsert({
    where: { email: `tech.phase5.${runSuffix}@hospital.com` },
    update: {},
    create: { email: `tech.phase5.${runSuffix}@hospital.com`, passwordHash, role: "LAB_TECHNICIAN" },
  });

  // Setup Doctor
  const docUser = await prisma.user.upsert({
    where: { email: `doctor.phase5.${runSuffix}@hospital.com` },
    update: {},
    create: { email: `doctor.phase5.${runSuffix}@hospital.com`, passwordHash, role: "DOCTOR" },
  });

  let dept = await prisma.department.findFirst();
  if (!dept) {
    dept = await prisma.department.create({
      data: { name: "Pathology Care " + runSuffix, description: "Diagnostics" },
    });
  }

  const doctor = await prisma.doctor.upsert({
    where: { userId: docUser.id },
    update: {},
    create: {
      userId: docUser.id,
      name: "Dr. Sarah Lin",
      specialization: "Internal Medicine",
      departmentId: dept.id,
      phone: "9988112233",
      email: docUser.email,
    },
  });

  // Setup Patient A
  const patAUser = await prisma.user.upsert({
    where: { email: `patientA.phase5.${runSuffix}@hospital.com` },
    update: {},
    create: { email: `patientA.phase5.${runSuffix}@hospital.com`, passwordHash, role: "PATIENT" },
  });

  const patientA = await prisma.patient.upsert({
    where: { userId: patAUser.id },
    update: {},
    create: {
      userId: patAUser.id,
      name: "Alice Walker",
      phone: "9988112244",
      dob: new Date("1992-04-15"),
      gender: "Female",
      bloodGroup: "A+",
      address: "124 Park Lane",
    },
  });

  // Setup Patient B (for ownership checks)
  const patBUser = await prisma.user.upsert({
    where: { email: `patientB.phase5.${runSuffix}@hospital.com` },
    update: {},
    create: { email: `patientB.phase5.${runSuffix}@hospital.com`, passwordHash, role: "PATIENT" },
  });

  const patientB = await prisma.patient.upsert({
    where: { userId: patBUser.id },
    update: {},
    create: {
      userId: patBUser.id,
      name: "Bob Jenkins",
      phone: "9988112255",
      dob: new Date("1988-11-20"),
      gender: "Male",
      bloodGroup: "B+",
      address: "45 Elm Street",
    },
  });

  // Setup Admin
  const adminUser = await prisma.user.upsert({
    where: { email: `admin.phase5.${runSuffix}@hospital.com` },
    update: {},
    create: { email: `admin.phase5.${runSuffix}@hospital.com`, passwordHash, role: "ADMIN" },
  });

  // Tokens
  const techToken = jwt.sign({ id: techUser.id, email: techUser.email, role: "LAB_TECHNICIAN" }, JWT_SECRET, { expiresIn: "1h" });
  const docToken = jwt.sign({ id: docUser.id, email: docUser.email, role: "DOCTOR", doctorId: doctor.id }, JWT_SECRET, { expiresIn: "1h" });
  const patAToken = jwt.sign({ id: patAUser.id, email: patAUser.email, role: "PATIENT", patientId: patientA.id }, JWT_SECRET, { expiresIn: "1h" });
  const patBToken = jwt.sign({ id: patBUser.id, email: patBUser.email, role: "PATIENT", patientId: patientB.id }, JWT_SECRET, { expiresIn: "1h" });
  const adminToken = jwt.sign({ id: adminUser.id, email: adminUser.email, role: "ADMIN" }, JWT_SECRET, { expiresIn: "1h" });

  const techClient = axios.create({ baseURL: API_BASE, headers: { Authorization: `Bearer ${techToken}` } });
  const docClient = axios.create({ baseURL: API_BASE, headers: { Authorization: `Bearer ${docToken}` } });
  const patAClient = axios.create({ baseURL: API_BASE, headers: { Authorization: `Bearer ${patAToken}` } });
  const patBClient = axios.create({ baseURL: API_BASE, headers: { Authorization: `Bearer ${patBToken}` } });
  const adminClient = axios.create({ baseURL: API_BASE, headers: { Authorization: `Bearer ${adminToken}` } });

  let testPassed = 0;
  let testFailed = 0;

  // Create / Get Catalog Test
  let labTest = await prisma.labTest.findFirst({ where: { code: "CBC" } });
  if (!labTest) {
    labTest = await prisma.labTest.create({
      data: {
        name: "Complete Blood Count Test " + runSuffix,
        code: "CBC-" + runSuffix,
        category: "Hematology",
        sampleType: "Whole Blood (EDTA)",
        price: 35.0,
        tatHours: 6,
      },
    });
  }

  // 1. Test 1: Doctor Valid Lab Order Creation
  let orderId = "";
  try {
    const orderRes = await docClient.post("/lab/orders", {
      patientId: patientA.id,
      labTestId: labTest.id,
      priority: "URGENT",
      clinicalNotes: "Patient presenting with acute weakness and pallor.",
    });

    if (orderRes.status === 201 && orderRes.data.orderNumber && orderRes.data.status === "ORDERED") {
      orderId = orderRes.data.id;
      console.log(`✅ TEST 1 PASSED: Doctor created lab order ${orderRes.data.orderNumber} with status ORDERED`);
      testPassed++;
    } else {
      console.error("❌ TEST 1 FAILED: Unexpected response", orderRes.data);
      testFailed++;
    }
  } catch (err: any) {
    console.error("❌ TEST 1 FAILED:", err.response?.data || err.message);
    testFailed++;
  }

  // 2. Test 2: Unauthorized Order Protection (Patient attempting to create lab order)
  try {
    await patAClient.post("/lab/orders", {
      patientId: patientA.id,
      labTestId: labTest.id,
      priority: "ROUTINE",
    });
    console.error("❌ TEST 2 FAILED: Patient was allowed to create a lab order!");
    testFailed++;
  } catch (err: any) {
    if (err.response?.status === 403) {
      console.log("✅ TEST 2 PASSED: Patient lab order creation rejected with HTTP 403 Forbidden");
      testPassed++;
    } else {
      console.error(`❌ TEST 2 FAILED: Expected 403, got ${err.response?.status}`);
      testFailed++;
    }
  }

  // 3. Test 3: Invalid State Transition (Entering results before specimen is collected)
  try {
    await techClient.post(`/lab/orders/${orderId}/results`, {
      parameterResults: [{ parameter: "Hemoglobin", value: "12.0", unit: "g/dL", referenceRange: "13-17", flag: "LOW" }],
      summary: "Mild anemia detected",
    });
    console.error("❌ TEST 3 FAILED: Results entry allowed before specimen collection!");
    testFailed++;
  } catch (err: any) {
    if (err.response?.status === 400 && err.response.data.error.includes("Specimen sample must be collected first")) {
      console.log(`✅ TEST 3 PASSED: Premature result entry rejected with HTTP 400: "${err.response.data.error}"`);
      testPassed++;
    } else {
      console.error(`❌ TEST 3 FAILED: Expected 400 premature result error, got ${err.response?.status}:`, err.response?.data);
      testFailed++;
    }
  }

  // 4. Test 4: Specimen Collection by Lab Technician
  try {
    const collectRes = await techClient.put(`/lab/orders/${orderId}/sample`);
    if (collectRes.status === 200 && collectRes.data.order.status === "SAMPLE_COLLECTED" && collectRes.data.order.sampleCollectedAt) {
      console.log("✅ TEST 4 PASSED: Specimen sample collected by lab technician. Status transitioned to SAMPLE_COLLECTED.");
      testPassed++;
    } else {
      console.error("❌ TEST 4 FAILED:", collectRes.data);
      testFailed++;
    }
  } catch (err: any) {
    console.error("❌ TEST 4 FAILED:", err.response?.data || err.message);
    testFailed++;
  }

  // 5. Test 5: Re-collecting Sample Rejection (Idempotency / State Machine Guard)
  try {
    await techClient.put(`/lab/orders/${orderId}/sample`);
    console.error("❌ TEST 5 FAILED: Duplicate sample collection allowed unexpectedly!");
    testFailed++;
  } catch (err: any) {
    if (err.response?.status === 400 && err.response.data.error.includes("already been collected")) {
      console.log(`✅ TEST 5 PASSED: Duplicate sample collection rejected with HTTP 400: "${err.response.data.error}"`);
      testPassed++;
    } else {
      console.error(`❌ TEST 5 FAILED: Expected 400, got ${err.response?.status}`);
      testFailed++;
    }
  }

  // 6. Test 6: Analytical Result Entry & Report Finalization by Lab Technician
  try {
    const resultRes = await techClient.post(`/lab/orders/${orderId}/results`, {
      parameterResults: [
        { parameter: "Hemoglobin (Hb)", value: "11.2", unit: "g/dL", referenceRange: "13.5 - 17.5", flag: "LOW" },
        { parameter: "WBC Count", value: "7800", unit: "/cumm", referenceRange: "4000 - 11000", flag: "NORMAL" },
        { parameter: "Platelet Count", value: "260000", unit: "/cumm", referenceRange: "150000 - 450000", flag: "NORMAL" },
      ],
      summary: "Microcytic hypochromic mild anemia. Suggest serum ferritin evaluation.",
      remarks: "Specimen tested on automated Sysmex XN analyzer.",
      approvedBy: "Dr. Emily Stone, MD (Pathologist)",
    });

    if (resultRes.status === 201 && resultRes.data.order.status === "COMPLETED" && resultRes.data.labResult.parameterResults.length === 3) {
      console.log("✅ TEST 6 PASSED: Technician entered results, finalized report with status COMPLETED and clinical flags");
      testPassed++;
    } else {
      console.error("❌ TEST 6 FAILED:", resultRes.data);
      testFailed++;
    }
  } catch (err: any) {
    console.error("❌ TEST 6 FAILED:", err.response?.data || err.message);
    testFailed++;
  }

  // 7. Test 7: Patient Ownership Protection (Patient B cannot view Patient A's lab order details)
  try {
    await patBClient.get(`/lab/orders/${orderId}`);
    console.error("❌ TEST 7 FAILED: Patient B was allowed to view Patient A's lab order!");
    testFailed++;
  } catch (err: any) {
    if (err.response?.status === 403) {
      console.log("✅ TEST 7 PASSED: Cross-patient lab report access strictly rejected with HTTP 403 Forbidden");
      testPassed++;
    } else {
      console.error(`❌ TEST 7 FAILED: Expected 403 Forbidden, got ${err.response?.status}`);
      testFailed++;
    }
  }

  // 8. Test 8: Patient Own Report Visibility (Patient A views own report with parameters)
  try {
    const patRes = await patAClient.get(`/lab/orders/${orderId}`);
    const patHistoryRes = await patAClient.get(`/lab/patients/${patientA.id}/reports`);

    if (
      patRes.status === 200 &&
      patRes.data.status === "COMPLETED" &&
      patRes.data.labResult.parameterResults.length === 3 &&
      patHistoryRes.data.totalCompletedReports >= 1
    ) {
      console.log("✅ TEST 8 PASSED: Patient A successfully retrieved own finalized diagnostic report with full parameter results");
      testPassed++;
    } else {
      console.error("❌ TEST 8 FAILED:", { patRes: patRes.data, history: patHistoryRes.data });
      testFailed++;
    }
  } catch (err: any) {
    console.error("❌ TEST 8 FAILED:", err.response?.data || err.message);
    testFailed++;
  }

  // 9. Test 9: Doctor EHR History & Order Review
  try {
    const docOrdersRes = await docClient.get("/lab/orders");
    const docPatientReportsRes = await docClient.get(`/lab/patients/${patientA.id}/reports`);

    const foundOrder = docOrdersRes.data.some((o: any) => o.id === orderId);
    if (foundOrder && docPatientReportsRes.data.reports.length >= 1) {
      console.log("✅ TEST 9 PASSED: Doctor retrieved lab orders queue and patient EHR diagnostic report history");
      testPassed++;
    } else {
      console.error("❌ TEST 9 FAILED: Doctor could not find order in queue or patient reports");
      testFailed++;
    }
  } catch (err: any) {
    console.error("❌ TEST 9 FAILED:", err.response?.data || err.message);
    testFailed++;
  }

  // 10. Test 10: Admin Summary Analytics & Audit Trail
  try {
    const summaryRes = await adminClient.get("/lab/summary");
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        action: { in: ["ORDER_LAB_TEST", "COLLECT_LAB_SAMPLE", "COMPLETE_LAB_RESULT"] },
      },
    });

    if (summaryRes.status === 200 && summaryRes.data.completedOrders >= 1 && auditLogs.length >= 3) {
      console.log("✅ TEST 10 PASSED: Admin retrieved lab operational summary and verified audit log trail for all lab actions");
      testPassed++;
    } else {
      console.error("❌ TEST 10 FAILED: Admin summary or audit trail mismatch", { summary: summaryRes.data, auditCount: auditLogs.length });
      testFailed++;
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

runPhase5Tests().catch((e) => {
  console.error("Fatal Test Error:", e);
  process.exit(1);
});
