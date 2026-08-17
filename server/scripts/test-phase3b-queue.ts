import axios from "axios";
import prisma from "../src/db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const API_BASE = "http://localhost:5000/api";
const JWT_SECRET = process.env.JWT_SECRET || "fallback_super_secret_jwt_key_2026";

async function runPhase3BTests() {
  console.log("==================================================");
  console.log("RUNNING PHASE 3B HOSPITAL QUEUE & CHECK-IN TEST SUITE");
  console.log("==================================================");

  const passwordHash = await bcrypt.hash("Password123!", 10);

  // 1. Setup Department, Doctors, Receptionist, and Patients
  let dept = await prisma.department.findFirst();
  if (!dept) {
    dept = await prisma.department.create({
      data: { name: "General Medicine " + Date.now(), description: "Primary Care" }
    });
  }

  // Doctor 1
  const docUser1 = await prisma.user.upsert({
    where: { email: "dr1.queue.phase3b@hospital.com" },
    update: {},
    create: { email: "dr1.queue.phase3b@hospital.com", passwordHash, role: "DOCTOR" }
  });
  const doctor1 = await prisma.doctor.upsert({
    where: { userId: docUser1.id },
    update: {},
    create: {
      userId: docUser1.id,
      name: "Dr. Alexander Wright",
      specialization: "General Physician",
      departmentId: dept.id,
      phone: "9112233440",
      email: "dr1.queue.phase3b@hospital.com"
    }
  });

  // Doctor 2
  const docUser2 = await prisma.user.upsert({
    where: { email: "dr2.queue.phase3b@hospital.com" },
    update: {},
    create: { email: "dr2.queue.phase3b@hospital.com", passwordHash, role: "DOCTOR" }
  });
  const doctor2 = await prisma.doctor.upsert({
    where: { userId: docUser2.id },
    update: {},
    create: {
      userId: docUser2.id,
      name: "Dr. Elena Rostova",
      specialization: "Cardiology",
      departmentId: dept.id,
      phone: "9112233441",
      email: "dr2.queue.phase3b@hospital.com"
    }
  });

  // Receptionist
  const recepUser = await prisma.user.upsert({
    where: { email: "receptionist.phase3b@hospital.com" },
    update: {},
    create: { email: "receptionist.phase3b@hospital.com", passwordHash, role: "RECEPTIONIST" }
  });

  // Patient 1
  const patUser1 = await prisma.user.upsert({
    where: { email: "patient1.queue.phase3b@hospital.com" },
    update: {},
    create: { email: "patient1.queue.phase3b@hospital.com", passwordHash, role: "PATIENT" }
  });
  const patient1 = await prisma.patient.upsert({
    where: { userId: patUser1.id },
    update: {},
    create: {
      userId: patUser1.id,
      name: "Arthur Pendelton",
      phone: "9887766551",
      dob: new Date("1988-03-20"),
      gender: "Male",
      bloodGroup: "O+",
      address: "221B Baker St"
    }
  });

  // Patient 2
  const patUser2 = await prisma.user.upsert({
    where: { email: "patient2.queue.phase3b@hospital.com" },
    update: {},
    create: { email: "patient2.queue.phase3b@hospital.com", passwordHash, role: "PATIENT" }
  });
  const patient2 = await prisma.patient.upsert({
    where: { userId: patUser2.id },
    update: {},
    create: {
      userId: patUser2.id,
      name: "Beatrice Miller",
      phone: "9887766552",
      dob: new Date("1994-07-11"),
      gender: "Female",
      bloodGroup: "B+",
      address: "42 Wallaby Way"
    }
  });

  // JWT Tokens
  const recepToken = jwt.sign({ id: recepUser.id, email: recepUser.email, role: "RECEPTIONIST" }, JWT_SECRET, { expiresIn: "1h" });
  const doc1Token = jwt.sign({ id: docUser1.id, email: docUser1.email, role: "DOCTOR", doctorId: doctor1.id }, JWT_SECRET, { expiresIn: "1h" });
  const doc2Token = jwt.sign({ id: docUser2.id, email: docUser2.email, role: "DOCTOR", doctorId: doctor2.id }, JWT_SECRET, { expiresIn: "1h" });
  const pat1Token = jwt.sign({ id: patUser1.id, email: patUser1.email, role: "PATIENT", patientId: patient1.id }, JWT_SECRET, { expiresIn: "1h" });
  const pat2Token = jwt.sign({ id: patUser2.id, email: patUser2.email, role: "PATIENT", patientId: patient2.id }, JWT_SECRET, { expiresIn: "1h" });

  const recepClient = axios.create({ baseURL: API_BASE, headers: { Authorization: `Bearer ${recepToken}` } });
  const doc1Client = axios.create({ baseURL: API_BASE, headers: { Authorization: `Bearer ${doc1Token}` } });
  const doc2Client = axios.create({ baseURL: API_BASE, headers: { Authorization: `Bearer ${doc2Token}` } });
  const pat1Client = axios.create({ baseURL: API_BASE, headers: { Authorization: `Bearer ${pat1Token}` } });

  let testPassed = 0;
  let testFailed = 0;

  // Prepare Today's Appointments
  const now = new Date();
  const todaySlot1 = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 10, 0, 0));
  const todaySlot2 = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 10, 30, 0));
  const todaySlot3 = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 11, 0, 0));

  // Create App 1 (Patient 1 with Doctor 1)
  const app1 = await prisma.appointment.create({
    data: {
      patientId: patient1.id,
      doctorId: doctor1.id,
      slotDateTime: todaySlot1,
      reason: "Fever and headache",
      status: "PENDING",
      queueStatus: "WAITING"
    }
  });

  // Create App 2 (Patient 2 with Doctor 1)
  const app2 = await prisma.appointment.create({
    data: {
      patientId: patient2.id,
      doctorId: doctor1.id,
      slotDateTime: todaySlot2,
      reason: "Routine review",
      status: "PENDING",
      queueStatus: "WAITING"
    }
  });

  // Create App 3 (Patient 1 with Doctor 2)
  const app3 = await prisma.appointment.create({
    data: {
      patientId: patient1.id,
      doctorId: doctor2.id,
      slotDateTime: todaySlot3,
      reason: "Cardio consultation",
      status: "PENDING",
      queueStatus: "WAITING"
    }
  });

  // Test 1 & 2: Patient with valid appointment can be checked in by receptionist & receives token
  let token1 = 0;
  try {
    const checkinRes = await recepClient.post(`/appointments/${app1.id}/check-in`);
    if (checkinRes.status === 200 && checkinRes.data.appointment.queueStatus === "CHECKED_IN" && checkinRes.data.appointment.tokenNumber) {
      token1 = checkinRes.data.appointment.tokenNumber;
      console.log(`✅ TEST 1 & 2 PASSED: Receptionist checked in patient 1, generated Token #${token1}`);
      testPassed += 2;
    } else {
      console.error("❌ TEST 1 & 2 FAILED:", checkinRes.data);
      testFailed += 2;
    }
  } catch (err: any) {
    console.error("❌ TEST 1 & 2 FAILED:", err.response?.data || err.message);
    testFailed += 2;
  }

  // Test 3: Duplicate check-in is rejected (HTTP 400)
  try {
    await recepClient.post(`/appointments/${app1.id}/check-in`);
    console.error("❌ TEST 3 FAILED: Duplicate check-in was allowed unexpectedly!");
    testFailed++;
  } catch (err: any) {
    if (err.response?.status === 400) {
      console.log(`✅ TEST 3 PASSED: Duplicate check-in rejected with HTTP 400: "${err.response.data.error}"`);
      testPassed++;
    } else {
      console.error(`❌ TEST 3 FAILED: Expected HTTP 400, got ${err.response?.status}:`, err.response?.data);
      testFailed++;
    }
  }

  // Test 4: Two patients receive different tokens
  let token2 = 0;
  try {
    const checkin2Res = await recepClient.post(`/appointments/${app2.id}/check-in`);
    token2 = checkin2Res.data.appointment.tokenNumber;
    if (checkin2Res.status === 200 && token2 !== token1 && token2 > token1) {
      console.log(`✅ TEST 4 PASSED: Patient 2 received incremental Token #${token2} (distinct from #${token1})`);
      testPassed++;
    } else {
      console.error(`❌ TEST 4 FAILED: Tokens not distinct. Token1=${token1}, Token2=${token2}`);
      testFailed++;
    }
  } catch (err: any) {
    console.error("❌ TEST 4 FAILED:", err.response?.data || err.message);
    testFailed++;
  }

  // Test 5: Queue endpoint returns today's checked-in patients with deterministic order
  try {
    const queueRes = await recepClient.get("/appointments/queue/today");
    if (queueRes.status === 200 && queueRes.data.queue.length >= 2) {
      const qTokens = queueRes.data.queue.filter((q: any) => q.doctorId === doctor1.id && q.tokenNumber);
      if (qTokens[0].tokenNumber <= qTokens[1].tokenNumber) {
        console.log(`✅ TEST 5 PASSED: Queue returned today's checked-in patients in deterministic token order (#${qTokens[0].tokenNumber}, #${qTokens[1].tokenNumber})`);
        testPassed++;
      } else {
        console.error("❌ TEST 5 FAILED: Queue sorting incorrect", qTokens);
        testFailed++;
      }
    } else {
      console.error("❌ TEST 5 FAILED:", queueRes.data);
      testFailed++;
    }
  } catch (err: any) {
    console.error("❌ TEST 5 FAILED:", err.response?.data || err.message);
    testFailed++;
  }

  // Test 6 & 8: Doctor can start their assigned patient's consultation & consultationStartedAt is recorded
  try {
    const startRes = await doc1Client.put(`/appointments/${app1.id}/start-consultation`);
    if (startRes.status === 200 && startRes.data.appointment.queueStatus === "IN_CONSULTATION" && startRes.data.appointment.consultationStartedAt) {
      console.log(`✅ TEST 6 & 8 PASSED: Doctor 1 started consultation. Status: IN_CONSULTATION, StartedAt: ${startRes.data.appointment.consultationStartedAt}`);
      testPassed += 2;
    } else {
      console.error("❌ TEST 6 & 8 FAILED:", startRes.data);
      testFailed += 2;
    }
  } catch (err: any) {
    console.error("❌ TEST 6 & 8 FAILED:", err.response?.data || err.message);
    testFailed += 2;
  }

  // Test 7: Doctor cannot start another doctor's appointment (HTTP 403 Forbidden)
  try {
    await doc2Client.put(`/appointments/${app1.id}/start-consultation`);
    console.error("❌ TEST 7 FAILED: Doctor 2 was able to start Doctor 1's appointment!");
    testFailed++;
  } catch (err: any) {
    if (err.response?.status === 403) {
      console.log(`✅ TEST 7 PASSED: Cross-doctor start consultation rejected with HTTP 403 Forbidden: "${err.response.data.error}"`);
      testPassed++;
    } else {
      console.error(`❌ TEST 7 FAILED: Expected HTTP 403, got ${err.response?.status}:`, err.response?.data);
      testFailed++;
    }
  }

  // Test 9: Consultation can be completed (IN_CONSULTATION -> COMPLETED)
  try {
    const completeRes = await doc1Client.put(`/appointments/${app1.id}/complete-consultation`);
    if (completeRes.status === 200 && completeRes.data.appointment.queueStatus === "COMPLETED" && completeRes.data.appointment.consultationCompletedAt) {
      console.log(`✅ TEST 9 PASSED: Doctor 1 completed consultation. Status: COMPLETED, CompletedAt: ${completeRes.data.appointment.consultationCompletedAt}`);
      testPassed++;
    } else {
      console.error("❌ TEST 9 FAILED:", completeRes.data);
      testFailed++;
    }
  } catch (err: any) {
    console.error("❌ TEST 9 FAILED:", err.response?.data || err.message);
    testFailed++;
  }

  // Test 10: Invalid state transition is rejected (e.g. COMPLETED -> IN_CONSULTATION or WAITING -> COMPLETED)
  try {
    // Attempt to start already completed consultation
    await doc1Client.put(`/appointments/${app1.id}/start-consultation`);
    console.error("❌ TEST 10 FAILED: Invalid state transition COMPLETED -> START was allowed!");
    testFailed++;
  } catch (err: any) {
    if (err.response?.status === 400) {
      console.log(`✅ TEST 10 PASSED: Invalid state transition rejected with HTTP 400: "${err.response.data.error}"`);
      testPassed++;
    } else {
      console.error(`❌ TEST 10 FAILED: Expected HTTP 400, got ${err.response?.status}:`, err.response?.data);
      testFailed++;
    }
  }

  // Test 11: Patient can see only their own queue status
  try {
    const patQueueRes = await pat1Client.get("/appointments/queue/today");
    if (patQueueRes.status === 200) {
      const allBelongToPatient1 = patQueueRes.data.queue.every((q: any) => q.patientId === patient1.id);
      if (allBelongToPatient1) {
        console.log(`✅ TEST 11 PASSED: Patient 1 query only returned their own appointments (${patQueueRes.data.queue.length} items, 0 other patients)`);
        testPassed++;
      } else {
        console.error("❌ TEST 11 FAILED: Patient saw records belonging to another patient!", patQueueRes.data);
        testFailed++;
      }
    } else {
      console.error("❌ TEST 11 FAILED:", patQueueRes.data);
      testFailed++;
    }
  } catch (err: any) {
    console.error("❌ TEST 11 FAILED:", err.response?.data || err.message);
    testFailed++;
  }

  // Test 12: Cancelled appointment cannot be checked in
  try {
    // Cancel app3
    await recepClient.put(`/appointments/${app3.id}`, { status: "CANCELLED" });
    await recepClient.post(`/appointments/${app3.id}/check-in`);
    console.error("❌ TEST 12 FAILED: Cancelled appointment check-in was allowed!");
    testFailed++;
  } catch (err: any) {
    if (err.response?.status === 400) {
      console.log(`✅ TEST 12 PASSED: Cancelled appointment check-in rejected with HTTP 400: "${err.response.data.error}"`);
      testPassed++;
    } else {
      console.error(`❌ TEST 12 FAILED: Expected HTTP 400, got ${err.response?.status}:`, err.response?.data);
      testFailed++;
    }
  }

  // Test 13: Concurrent check-in does not create duplicate tokens
  try {
    // Create 3 fresh appointments for Doctor 2
    const concurrentApps = await Promise.all([
      prisma.appointment.create({
        data: {
          patientId: patient1.id,
          doctorId: doctor2.id,
          slotDateTime: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 14, 0, 0)),
          reason: "Concurrent 1",
          status: "PENDING",
          queueStatus: "WAITING"
        }
      }),
      prisma.appointment.create({
        data: {
          patientId: patient2.id,
          doctorId: doctor2.id,
          slotDateTime: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 14, 15, 0)),
          reason: "Concurrent 2",
          status: "PENDING",
          queueStatus: "WAITING"
        }
      }),
      prisma.appointment.create({
        data: {
          patientId: patient1.id,
          doctorId: doctor2.id,
          slotDateTime: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 14, 30, 0)),
          reason: "Concurrent 3",
          status: "PENDING",
          queueStatus: "WAITING"
        }
      }),
    ]);

    // Send 3 check-in requests concurrently
    const checkinResults = await Promise.all(
      concurrentApps.map(app => recepClient.post(`/appointments/${app.id}/check-in`))
    );

    const generatedTokens = checkinResults.map(r => r.data.appointment.tokenNumber);
    const uniqueTokens = new Set(generatedTokens);

    if (uniqueTokens.size === 3) {
      console.log(`✅ TEST 13 PASSED: 3 concurrent check-ins generated 3 distinct tokens: [${generatedTokens.join(", ")}]`);
      testPassed++;
    } else {
      console.error(`❌ TEST 13 FAILED: Duplicate tokens detected in concurrent check-in: [${generatedTokens.join(", ")}]`);
      testFailed++;
    }
  } catch (err: any) {
    console.error("❌ TEST 13 FAILED:", err.response?.data || err.message);
    testFailed++;
  }

  console.log("==================================================");
  console.log(`RESULTS: ${testPassed} Passed, ${testFailed} Failed`);
  console.log("==================================================");

  if (testFailed > 0) {
    process.exit(1);
  }
}

runPhase3BTests().catch((e) => {
  console.error("Fatal Test Error:", e);
  process.exit(1);
});
