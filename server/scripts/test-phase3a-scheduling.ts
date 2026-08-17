import axios from "axios";
import prisma from "../src/db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const API_BASE = "http://localhost:5000/api";
const JWT_SECRET = process.env.JWT_SECRET || "fallback_super_secret_jwt_key_2026";

async function runPhase3ATests() {
  console.log("==================================================");
  console.log("RUNNING PHASE 3A SCHEDULING & CONFLICT TEST SUITE");
  console.log("==================================================");

  // 1. Setup Test Doctor 1 and Test Doctor 2 and Test Patient
  const passwordHash = await bcrypt.hash("Password123!", 10);

  // Department
  let dept = await prisma.department.findFirst();
  if (!dept) {
    dept = await prisma.department.create({
      data: { name: "General Medicine " + Date.now(), description: "Primary Care" }
    });
  }

  // Doctor 1 User & Profile
  const docUser1 = await prisma.user.upsert({
    where: { email: "test.dr1.phase3@hospital.com" },
    update: {},
    create: {
      email: "test.dr1.phase3@hospital.com",
      passwordHash,
      role: "DOCTOR"
    }
  });

  const doctor1 = await prisma.doctor.upsert({
    where: { userId: docUser1.id },
    update: {},
    create: {
      userId: docUser1.id,
      name: "Dr. Sarah Adams",
      specialization: "General Physician",
      departmentId: dept.id,
      phone: "1234567890",
      email: "test.dr1.phase3@hospital.com"
    }
  });

  // Doctor 2 User & Profile
  const docUser2 = await prisma.user.upsert({
    where: { email: "test.dr2.phase3@hospital.com" },
    update: {},
    create: {
      email: "test.dr2.phase3@hospital.com",
      passwordHash,
      role: "DOCTOR"
    }
  });

  const doctor2 = await prisma.doctor.upsert({
    where: { userId: docUser2.id },
    update: {},
    create: {
      userId: docUser2.id,
      name: "Dr. Robert Lee",
      specialization: "Cardiology",
      departmentId: dept.id,
      phone: "1234567891",
      email: "test.dr2.phase3@hospital.com"
    }
  });

  // Patient User & Profile
  const patUser = await prisma.user.upsert({
    where: { email: "test.patient.phase3@hospital.com" },
    update: {},
    create: {
      email: "test.patient.phase3@hospital.com",
      passwordHash,
      role: "PATIENT"
    }
  });

  const patient = await prisma.patient.upsert({
    where: { userId: patUser.id },
    update: {},
    create: {
      userId: patUser.id,
      name: "Alice Walker",
      phone: "9876543210",
      dob: new Date("1992-05-15"),
      gender: "Female",
      bloodGroup: "A+",
      address: "100 Maple St"
    }
  });

  const patientToken = jwt.sign(
    { id: patUser.id, email: patUser.email, role: patUser.role, patientId: patient.id },
    JWT_SECRET,
    { expiresIn: "1h" }
  );

  const client = axios.create({
    baseURL: API_BASE,
    headers: { Authorization: `Bearer ${patientToken}` }
  });

  let testPassed = 0;
  let testFailed = 0;

  // Unique Monday date for this test run (to ensure idempotency)
  const monday = new Date();
  const randomWeekOffset = Math.floor(Math.random() * 40) + 2;
  monday.setDate(monday.getDate() + ((1 + 7 - monday.getDay()) % 7 || 7) + 7 * randomWeekOffset);
  const mondayStr = monday.toISOString().split("T")[0]; // YYYY-MM-DD

  // Sunday date (non-working day)
  const sunday = new Date();
  sunday.setDate(sunday.getDate() + ((0 + 7 - sunday.getDay()) % 7 || 7) + 7 * randomWeekOffset);
  const sundayStr = sunday.toISOString().split("T")[0];

  console.log(`Test Date (Monday): ${mondayStr}`);
  console.log(`Test Date (Sunday): ${sundayStr}`);

  // Test 1: Doctor Availability & Slots Generation
  try {
    const slotsRes = await client.get(`/appointments/doctors/${doctor1.id}/slots?date=${mondayStr}`);
    if (slotsRes.status === 200 && slotsRes.data.isWorkingDay && slotsRes.data.slots.length > 0) {
      console.log(`✅ TEST 1 PASSED: Generated ${slotsRes.data.slots.length} bookable slots for doctor on ${mondayStr}`);
      testPassed++;
    } else {
      console.error("❌ TEST 1 FAILED: Unexpected response", slotsRes.data);
      testFailed++;
    }
  } catch (err: any) {
    console.error("❌ TEST 1 FAILED:", err.response?.data || err.message);
    testFailed++;
  }

  // Test 2: Valid Appointment Booking
  const validSlotTime = `${mondayStr}T10:00:00.000Z`;
  let app1Id = "";
  try {
    const bookRes = await client.post("/appointments", {
      doctorId: doctor1.id,
      slotDateTime: validSlotTime,
      reason: "Regular Health Checkup",
    });
    if (bookRes.status === 201 && bookRes.data.id) {
      app1Id = bookRes.data.id;
      console.log(`✅ TEST 2 PASSED: Successfully booked appointment (${app1Id}) at ${validSlotTime}`);
      testPassed++;
    } else {
      console.error("❌ TEST 2 FAILED:", bookRes.data);
      testFailed++;
    }
  } catch (err: any) {
    console.error("❌ TEST 2 FAILED:", err.response?.data || err.message);
    testFailed++;
  }

  // Test 3: Same Doctor + Same Slot -> 409 Conflict
  try {
    await client.post("/appointments", {
      doctorId: doctor1.id,
      slotDateTime: validSlotTime,
      reason: "Double booking attempt",
    });
    console.error("❌ TEST 3 FAILED: Double booking was allowed unexpectedly!");
    testFailed++;
  } catch (err: any) {
    if (err.response?.status === 409) {
      console.log(`✅ TEST 3 PASSED: Double booking same doctor + same slot rejected with HTTP 409 Conflict: "${err.response.data.error}"`);
      testPassed++;
    } else {
      console.error(`❌ TEST 3 FAILED: Expected HTTP 409, got ${err.response?.status}:`, err.response?.data);
      testFailed++;
    }
  }

  // Test 4: Same Doctor + Overlapping Slot (e.g. 10:05 within 10:00-10:15 window) -> 409 Conflict
  const overlappingSlotTime = `${mondayStr}T10:05:00.000Z`;
  try {
    await client.post("/appointments", {
      doctorId: doctor1.id,
      slotDateTime: overlappingSlotTime,
      reason: "Overlapping booking attempt",
    });
    console.error("❌ TEST 4 FAILED: Overlapping booking was allowed unexpectedly!");
    testFailed++;
  } catch (err: any) {
    if (err.response?.status === 409) {
      console.log(`✅ TEST 4 PASSED: Overlapping slot rejected with HTTP 409 Conflict: "${err.response.data.error}"`);
      testPassed++;
    } else {
      console.error(`❌ TEST 4 FAILED: Expected HTTP 409, got ${err.response?.status}:`, err.response?.data);
      testFailed++;
    }
  }

  // Test 5: Different Doctor + Same Time Slot -> Allowed (HTTP 201)
  try {
    const bookDoc2Res = await client.post("/appointments", {
      doctorId: doctor2.id,
      slotDateTime: validSlotTime,
      reason: "Consultation with Doctor 2",
    });
    if (bookDoc2Res.status === 201) {
      console.log(`✅ TEST 5 PASSED: Different doctor booked at same time ${validSlotTime} allowed (HTTP 201)`);
      testPassed++;
    } else {
      console.error("❌ TEST 5 FAILED:", bookDoc2Res.data);
      testFailed++;
    }
  } catch (err: any) {
    console.error("❌ TEST 5 FAILED:", err.response?.data || err.message);
    testFailed++;
  }

  // Test 6: Cancelled Appointment + Same Slot -> Allowed
  try {
    // Cancel app1
    await client.put(`/appointments/${app1Id}`, { status: "CANCELLED" });
    // Now book same slot for Doctor 1 again
    const rebookRes = await client.post("/appointments", {
      doctorId: doctor1.id,
      slotDateTime: validSlotTime,
      reason: "Rebooking slot after cancellation",
    });
    if (rebookRes.status === 201) {
      console.log(`✅ TEST 6 PASSED: Rebooking previously cancelled slot allowed (HTTP 201)`);
      testPassed++;
    } else {
      console.error("❌ TEST 6 FAILED:", rebookRes.data);
      testFailed++;
    }
  } catch (err: any) {
    console.error("❌ TEST 6 FAILED:", err.response?.data || err.message);
    testFailed++;
  }

  // Test 7: Outside Working Hours (e.g. 06:00 AM) -> Rejected (HTTP 400)
  const earlySlotTime = `${mondayStr}T06:00:00.000Z`;
  try {
    await client.post("/appointments", {
      doctorId: doctor1.id,
      slotDateTime: earlySlotTime,
      reason: "Early morning booking",
    });
    console.error("❌ TEST 7 FAILED: Booking outside working hours was allowed unexpectedly!");
    testFailed++;
  } catch (err: any) {
    if (err.response?.status === 400) {
      console.log(`✅ TEST 7 PASSED: Slot outside working hours rejected with HTTP 400: "${err.response.data.error}"`);
      testPassed++;
    } else {
      console.error(`❌ TEST 7 FAILED: Expected HTTP 400, got ${err.response?.status}:`, err.response?.data);
      testFailed++;
    }
  }

  // Test 8: Non-working Day (e.g. Sunday) -> Rejected (HTTP 400)
  const sundaySlotTime = `${sundayStr}T10:00:00.000Z`;
  try {
    await client.post("/appointments", {
      doctorId: doctor1.id,
      slotDateTime: sundaySlotTime,
      reason: "Sunday booking attempt",
    });
    console.error("❌ TEST 8 FAILED: Booking on non-working day was allowed unexpectedly!");
    testFailed++;
  } catch (err: any) {
    if (err.response?.status === 400) {
      console.log(`✅ TEST 8 PASSED: Non-working day booking rejected with HTTP 400: "${err.response.data.error}"`);
      testPassed++;
    } else {
      console.error(`❌ TEST 8 FAILED: Expected HTTP 400, got ${err.response?.status}:`, err.response?.data);
      testFailed++;
    }
  }

  console.log("==================================================");
  console.log(`RESULTS: ${testPassed} Passed, ${testFailed} Failed`);
  console.log("==================================================");

  if (testFailed > 0) {
    process.exit(1);
  }
}

runPhase3ATests().catch((e) => {
  console.error("Fatal Test Error:", e);
  process.exit(1);
});
