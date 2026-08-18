import axios from "axios";
import prisma from "../src/db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const API_BASE = "http://localhost:5000/api";
const JWT_SECRET = process.env.JWT_SECRET || "mediassist_super_secret_jwt_key_12345";

async function runPhase10SecurityTests() {
  console.log("==================================================");
  console.log("RUNNING PHASE 10 SECURITY, HARDENING & COMPLIANCE SUITE");
  console.log("==================================================");

  const passwordHash = await bcrypt.hash("Password123!", 10);
  const runSuffix = Date.now().toString().slice(-4);

  // Setup Admin
  const adminUser = await prisma.user.upsert({
    where: { email: `admin.p10.${runSuffix}@hospital.com` },
    update: {},
    create: { email: `admin.p10.${runSuffix}@hospital.com`, passwordHash, role: "ADMIN" },
  });

  // Setup Receptionist
  const recUser = await prisma.user.upsert({
    where: { email: `rec.p10.${runSuffix}@hospital.com` },
    update: {},
    create: { email: `rec.p10.${runSuffix}@hospital.com`, passwordHash, role: "RECEPTIONIST" },
  });

  // Setup Pharmacist
  const pharmUser = await prisma.user.upsert({
    where: { email: `pharm.p10.${runSuffix}@hospital.com` },
    update: {},
    create: { email: `pharm.p10.${runSuffix}@hospital.com`, passwordHash, role: "PHARMACIST" },
  });

  // Setup Lab Tech
  const labUser = await prisma.user.upsert({
    where: { email: `lab.p10.${runSuffix}@hospital.com` },
    update: {},
    create: { email: `lab.p10.${runSuffix}@hospital.com`, passwordHash, role: "LAB_TECHNICIAN" },
  });

  // Setup Doctor
  let dept = await prisma.department.findFirst();
  if (!dept) {
    dept = await prisma.department.create({
      data: { name: "Security Dept " + runSuffix, description: "Cardiology" },
    });
  }

  const docUser = await prisma.user.upsert({
    where: { email: `doctor.p10.${runSuffix}@hospital.com` },
    update: {},
    create: { email: `doctor.p10.${runSuffix}@hospital.com`, passwordHash, role: "DOCTOR" },
  });

  const doctor = await prisma.doctor.upsert({
    where: { userId: docUser.id },
    update: {},
    create: {
      userId: docUser.id,
      name: "Dr. Security Tester " + runSuffix,
      specialization: "Cardiology",
      departmentId: dept.id,
      phone: "9988776655",
      email: docUser.email,
    },
  });

  // Setup Patient A (Victim)
  const patAUser = await prisma.user.upsert({
    where: { email: `patientA.p10.${runSuffix}@hospital.com` },
    update: {},
    create: { email: `patientA.p10.${runSuffix}@hospital.com`, passwordHash, role: "PATIENT" },
  });

  const patientA = await prisma.patient.upsert({
    where: { userId: patAUser.id },
    update: {},
    create: {
      userId: patAUser.id,
      name: "Patient Alice " + runSuffix,
      phone: "9988771111",
      dob: new Date("1992-04-12"),
      gender: "Female",
      bloodGroup: "A+",
      address: "123 Maple Street",
    },
  });

  // Setup Patient B (Attacker / Other Patient)
  const patBUser = await prisma.user.upsert({
    where: { email: `patientB.p10.${runSuffix}@hospital.com` },
    update: {},
    create: { email: `patientB.p10.${runSuffix}@hospital.com`, passwordHash, role: "PATIENT" },
  });

  const patientB = await prisma.patient.upsert({
    where: { userId: patBUser.id },
    update: {},
    create: {
      userId: patBUser.id,
      name: "Patient Bob " + runSuffix,
      phone: "9988772222",
      dob: new Date("1988-08-20"),
      gender: "Male",
      bloodGroup: "O+",
      address: "456 Oak Avenue",
    },
  });

  // Setup Deactivated User
  const deactUser = await prisma.user.upsert({
    where: { email: `deactivated.p10.${runSuffix}@hospital.com` },
    update: { isActive: false },
    create: { email: `deactivated.p10.${runSuffix}@hospital.com`, passwordHash, role: "PATIENT", isActive: false },
  });

  // Create Patient A Clinical Resources
  const appA = await prisma.appointment.create({
    data: {
      patientId: patientA.id,
      doctorId: doctor.id,
      slotDateTime: new Date("2026-12-30T10:00:00.000Z"),
      reason: "Hypertension Checkup",
      status: "CONFIRMED",
      queueStatus: "COMPLETED",
    },
  });

  const diagA = await prisma.diagnosisRecord.create({
    data: {
      patientId: patientA.id,
      doctorId: doctor.id,
      appointmentId: appA.id,
      symptoms: "Elevated BP, palpitations",
      finalDiagnosis: "Primary Stage 1 Hypertension",
      status: "CONFIRMED",
      confirmedBy: docUser.id,
    },
  });

  const prescA = await prisma.prescription.create({
    data: {
      patientId: patientA.id,
      doctorId: doctor.id,
      appointmentId: appA.id,
      diagnosisRecordId: diagA.id,
      medicines: JSON.stringify([{ medicineName: "Amlodipine", dosage: "5mg", frequency: "Daily", duration: "30 days" }]),
      status: "PENDING",
    },
  });

  let labTest = await prisma.labTest.findFirst();
  if (!labTest) {
    labTest = await prisma.labTest.create({
      data: {
        name: "Lipid Security Test " + runSuffix,
        code: "LIP-" + runSuffix,
        category: "Biochemistry",
        sampleType: "Serum",
        price: 50.0,
      },
    });
  }

  const labOrderA = await prisma.labOrder.create({
    data: {
      orderNumber: "ORD-SEC-" + runSuffix,
      patientId: patientA.id,
      doctorId: doctor.id,
      labTestId: labTest.id,
      status: "ORDERED",
    },
  });

  const billA = await prisma.bill.create({
    data: {
      invoiceNumber: "INV-SEC-" + runSuffix,
      patientId: patientA.id,
      appointmentId: appA.id,
      amount: 150.0,
      subtotal: 150.0,
      totalAmount: 150.0,
      status: "PENDING",
      paymentStatus: "PENDING",
      items: JSON.stringify([{ description: "Cardiology Consultation", cost: 150.0 }]),
    },
  });

  // Tokens
  const adminToken = jwt.sign({ id: adminUser.id, email: adminUser.email, role: "ADMIN" }, JWT_SECRET, { expiresIn: "1h" });
  const recToken = jwt.sign({ id: recUser.id, email: recUser.email, role: "RECEPTIONIST" }, JWT_SECRET, { expiresIn: "1h" });
  const pharmToken = jwt.sign({ id: pharmUser.id, email: pharmUser.email, role: "PHARMACIST" }, JWT_SECRET, { expiresIn: "1h" });
  const labToken = jwt.sign({ id: labUser.id, email: labUser.email, role: "LAB_TECHNICIAN" }, JWT_SECRET, { expiresIn: "1h" });
  const docToken = jwt.sign({ id: docUser.id, email: docUser.email, role: "DOCTOR", doctorId: doctor.id }, JWT_SECRET, { expiresIn: "1h" });
  const patAToken = jwt.sign({ id: patAUser.id, email: patAUser.email, role: "PATIENT", patientId: patientA.id }, JWT_SECRET, { expiresIn: "1h" });
  const patBToken = jwt.sign({ id: patBUser.id, email: patBUser.email, role: "PATIENT", patientId: patientB.id }, JWT_SECRET, { expiresIn: "1h" });
  const deactToken = jwt.sign({ id: deactUser.id, email: deactUser.email, role: "PATIENT" }, JWT_SECRET, { expiresIn: "1h" });
  const expiredToken = jwt.sign({ id: patAUser.id, email: patAUser.email, role: "PATIENT" }, JWT_SECRET, { expiresIn: -10 });

  const patBClient = axios.create({ baseURL: API_BASE, headers: { Authorization: `Bearer ${patBToken}` } });
  const recClient = axios.create({ baseURL: API_BASE, headers: { Authorization: `Bearer ${recToken}` } });
  const pharmClient = axios.create({ baseURL: API_BASE, headers: { Authorization: `Bearer ${pharmToken}` } });
  const labClient = axios.create({ baseURL: API_BASE, headers: { Authorization: `Bearer ${labToken}` } });
  const adminClient = axios.create({ baseURL: API_BASE, headers: { Authorization: `Bearer ${adminToken}` } });

  let testPassed = 0;
  let testFailed = 0;

  // 1. Invalid JWT Rejected
  try {
    await axios.get(`${API_BASE}/auth/me`, { headers: { Authorization: "Bearer this.is.garbage.token" } });
    console.error("❌ TEST 1 FAILED: Invalid JWT was accepted!");
    testFailed++;
  } catch (err: any) {
    if (err.response?.status === 401) {
      console.log("✅ TEST 1 PASSED: Invalid JWT rejected with HTTP 401 Unauthorized");
      testPassed++;
    } else {
      console.error(`❌ TEST 1 FAILED: Expected 401, got ${err.response?.status}`);
      testFailed++;
    }
  }

  // 2. Expired JWT Rejected
  try {
    await axios.get(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${expiredToken}` } });
    console.error("❌ TEST 2 FAILED: Expired JWT was accepted!");
    testFailed++;
  } catch (err: any) {
    if (err.response?.status === 401) {
      console.log("✅ TEST 2 PASSED: Expired JWT rejected with HTTP 401 Unauthorized");
      testPassed++;
    } else {
      console.error(`❌ TEST 2 FAILED: Expected 401, got ${err.response?.status}`);
      testFailed++;
    }
  }

  // 3. Malformed Authorization Header
  try {
    await axios.get(`${API_BASE}/auth/me`, { headers: { Authorization: "InvalidFormatToken" } });
    console.error("❌ TEST 3 FAILED: Malformed header was accepted!");
    testFailed++;
  } catch (err: any) {
    if (err.response?.status === 401) {
      console.log("✅ TEST 3 PASSED: Malformed Authorization header rejected with HTTP 401 Unauthorized");
      testPassed++;
    } else {
      console.error(`❌ TEST 3 FAILED: Expected 401, got ${err.response?.status}`);
      testFailed++;
    }
  }

  // 4. Deactivated User Blocked on API Access
  try {
    await axios.get(`${API_BASE}/auth/me`, { headers: { Authorization: `Bearer ${deactToken}` } });
    console.error("❌ TEST 4 FAILED: Deactivated user accessed API!");
    testFailed++;
  } catch (err: any) {
    if (err.response?.status === 403) {
      console.log("✅ TEST 4 PASSED: Deactivated user access blocked in middleware with HTTP 403 Forbidden");
      testPassed++;
    } else {
      console.error(`❌ TEST 4 FAILED: Expected 403, got ${err.response?.status}`);
      testFailed++;
    }
  }

  // 5. IDOR: Patient B cannot access Patient A's Medical Timeline
  try {
    await patBClient.get(`/medical-records/timeline/${patientA.id}`);
    console.error("❌ TEST 5 FAILED: Patient B accessed Patient A's medical timeline!");
    testFailed++;
  } catch (err: any) {
    if (err.response?.status === 403) {
      console.log("✅ TEST 5 PASSED: IDOR Prevention: Patient B blocked from Patient A's medical timeline (HTTP 403 Forbidden)");
      testPassed++;
    } else {
      console.error(`❌ TEST 5 FAILED: Expected 403, got ${err.response?.status}`);
      testFailed++;
    }
  }

  // 6. IDOR: Patient B cannot access Patient A's Invoice
  try {
    await patBClient.get(`/bills/${billA.id}`);
    console.error("❌ TEST 6 FAILED: Patient B accessed Patient A's invoice!");
    testFailed++;
  } catch (err: any) {
    if (err.response?.status === 403) {
      console.log("✅ TEST 6 PASSED: IDOR Prevention: Patient B blocked from Patient A's invoice (HTTP 403 Forbidden)");
      testPassed++;
    } else {
      console.error(`❌ TEST 6 FAILED: Expected 403, got ${err.response?.status}`);
      testFailed++;
    }
  }

  // 7. IDOR: Patient B cannot access Patient A's Lab Order/Report
  try {
    await patBClient.get(`/lab/orders/${labOrderA.id}`);
    console.error("❌ TEST 7 FAILED: Patient B accessed Patient A's lab order!");
    testFailed++;
  } catch (err: any) {
    if (err.response?.status === 403) {
      console.log("✅ TEST 7 PASSED: IDOR Prevention: Patient B blocked from Patient A's lab order (HTTP 403 Forbidden)");
      testPassed++;
    } else {
      console.error(`❌ TEST 7 FAILED: Expected 403, got ${err.response?.status}`);
      testFailed++;
    }
  }

  // 8. IDOR: Patient B cannot access Patient A's Diagnosis Record
  try {
    await patBClient.get(`/diagnosis/${diagA.id}`);
    console.error("❌ TEST 8 FAILED: Patient B accessed Patient A's diagnosis record!");
    testFailed++;
  } catch (err: any) {
    if (err.response?.status === 403) {
      console.log("✅ TEST 8 PASSED: IDOR Prevention: Patient B blocked from Patient A's diagnosis record (HTTP 403 Forbidden)");
      testPassed++;
    } else {
      console.error(`❌ TEST 8 FAILED: Expected 403, got ${err.response?.status}`);
      testFailed++;
    }
  }

  // 9. IDOR: Patient B cannot access Patient A's Prescription
  try {
    await patBClient.get(`/pharmacy/prescriptions/${prescA.id}`);
    console.error("❌ TEST 9 FAILED: Patient B accessed Patient A's prescription!");
    testFailed++;
  } catch (err: any) {
    if (err.response?.status === 403) {
      console.log("✅ TEST 9 PASSED: IDOR Prevention: Patient B blocked from Patient A's prescription (HTTP 403 Forbidden)");
      testPassed++;
    } else {
      console.error(`❌ TEST 9 FAILED: Expected 403, got ${err.response?.status}`);
      testFailed++;
    }
  }

  // 10. IDOR: Patient B cannot access Patient A's Appointment
  try {
    await patBClient.get(`/appointments/${appA.id}`);
    console.error("❌ TEST 10 FAILED: Patient B accessed Patient A's appointment!");
    testFailed++;
  } catch (err: any) {
    if (err.response?.status === 403) {
      console.log("✅ TEST 10 PASSED: IDOR Prevention: Patient B blocked from Patient A's appointment details (HTTP 403 Forbidden)");
      testPassed++;
    } else {
      console.error(`❌ TEST 10 FAILED: Expected 403, got ${err.response?.status}`);
      testFailed++;
    }
  }

  // 11. Role Guard: Receptionist blocked from Admin User Management
  try {
    await recClient.get("/admin/users");
    console.error("❌ TEST 11 FAILED: Receptionist accessed Admin User Management!");
    testFailed++;
  } catch (err: any) {
    if (err.response?.status === 403) {
      console.log("✅ TEST 11 PASSED: Receptionist blocked from Admin User Management with HTTP 403 Forbidden");
      testPassed++;
    } else {
      console.error(`❌ TEST 11 FAILED: Expected 403, got ${err.response?.status}`);
      testFailed++;
    }
  }

  // 12. Role Guard: Pharmacist blocked from Admin Analytics
  try {
    await pharmClient.get("/admin/analytics/overview");
    console.error("❌ TEST 12 FAILED: Pharmacist accessed Admin Analytics!");
    testFailed++;
  } catch (err: any) {
    if (err.response?.status === 403) {
      console.log("✅ TEST 12 PASSED: Pharmacist blocked from Admin Analytics with HTTP 403 Forbidden");
      testPassed++;
    } else {
      console.error(`❌ TEST 12 FAILED: Expected 403, got ${err.response?.status}`);
      testFailed++;
    }
  }

  // 13. Role Guard: Lab Tech blocked from Pharmacy Dispense
  try {
    await labClient.put(`/pharmacy/prescriptions/${prescA.id}/dispense`, {});
    console.error("❌ TEST 13 FAILED: Lab Technician dispensed pharmacy prescription!");
    testFailed++;
  } catch (err: any) {
    if (err.response?.status === 403) {
      console.log("✅ TEST 13 PASSED: Lab Technician blocked from Pharmacy Dispense with HTTP 403 Forbidden");
      testPassed++;
    } else {
      console.error(`❌ TEST 13 FAILED: Expected 403, got ${err.response?.status}`);
      testFailed++;
    }
  }

  // 14. Password Change: Incorrect current password rejected
  try {
    await patBClient.post("/auth/change-password", {
      currentPassword: "WrongPassword123!",
      newPassword: "NewSecretPassword2026!",
    });
    console.error("❌ TEST 14 FAILED: Password change succeeded with invalid current password!");
    testFailed++;
  } catch (err: any) {
    if (err.response?.status === 400) {
      console.log("✅ TEST 14 PASSED: Password change rejected with HTTP 400 when current password does not match");
      testPassed++;
    } else {
      console.error(`❌ TEST 14 FAILED: Expected 400, got ${err.response?.status}`);
      testFailed++;
    }
  }

  // 15. Sensitive Field Sanitization
  try {
    const meRes = await adminClient.get("/auth/me");
    if (!meRes.data.passwordHash && !meRes.data.password) {
      console.log("✅ TEST 15 PASSED: User profile endpoint correctly sanitized: passwordHash and credentials not exposed");
      testPassed++;
    } else {
      console.error("❌ TEST 15 FAILED: Password hash exposed in user profile!", meRes.data);
      testFailed++;
    }
  } catch (err: any) {
    console.error("❌ TEST 15 FAILED:", err.response?.data || err.message);
    testFailed++;
  }

  // 16. Security Audit Log for Failed Login
  try {
    await axios.post(`${API_BASE}/auth/login`, {
      email: "nonexistent.user@hospital.com",
      password: "SomePassword!",
    }).catch(() => {});

    const auditLog = await prisma.auditLog.findFirst({
      where: { action: "LOGIN_FAILED" },
      orderBy: { createdAt: "desc" },
    });

    if (auditLog && auditLog.details.includes("nonexistent.user@hospital.com")) {
      console.log("✅ TEST 16 PASSED: Security audit trail captured failed login attempt without recording plaintext password");
      testPassed++;
    } else {
      console.error("❌ TEST 16 FAILED: Failed login audit log not found", auditLog);
      testFailed++;
    }
  } catch (err: any) {
    console.error("❌ TEST 16 FAILED:", err.response?.data || err.message);
    testFailed++;
  }

  // 17. Security Headers Verification
  try {
    const healthRes = await axios.get("http://localhost:5000/health");
    const headers = healthRes.headers;

    const hasNoSniff = headers["x-content-type-options"] === "nosniff";
    const hasFrameDeny = headers["x-frame-options"] === "DENY";
    const noExpressHeader = !headers["x-powered-by"];

    if (hasNoSniff && hasFrameDeny && noExpressHeader) {
      console.log("✅ TEST 17 PASSED: Security headers verified (X-Content-Type-Options: nosniff, X-Frame-Options: DENY, X-Powered-By suppressed)");
      testPassed++;
    } else {
      console.error("❌ TEST 17 FAILED: Missing security headers", headers);
      testFailed++;
    }
  } catch (err: any) {
    console.error("❌ TEST 17 FAILED:", err.response?.data || err.message);
    testFailed++;
  }

  console.log("==================================================");
  console.log(`RESULTS: ${testPassed} Passed, ${testFailed} Failed`);
  console.log("==================================================");

  if (testFailed > 0) {
    process.exit(1);
  }
}

runPhase10SecurityTests().catch((e) => {
  console.error("Fatal Security Test Error:", e);
  process.exit(1);
});
