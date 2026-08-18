import axios from "axios";
import prisma from "../src/db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import http from "http";

const API_BASE = "http://localhost:5000/api";
const JWT_SECRET = process.env.JWT_SECRET || "mediassist_super_secret_jwt_key_12345";

async function runPhase7Tests() {
  console.log("==================================================");
  console.log("RUNNING PHASE 7 NOTIFICATIONS & REAL-TIME SSE SUITE");
  console.log("==================================================");

  const passwordHash = await bcrypt.hash("Password123!", 10);
  const runSuffix = Date.now().toString().slice(-4);

  // Setup Patient A User
  const patAUser = await prisma.user.upsert({
    where: { email: `patientA.phase7.${runSuffix}@hospital.com` },
    update: {},
    create: { email: `patientA.phase7.${runSuffix}@hospital.com`, passwordHash, role: "PATIENT" },
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
    },
  });

  // Setup Patient B User
  const patBUser = await prisma.user.upsert({
    where: { email: `patientB.phase7.${runSuffix}@hospital.com` },
    update: {},
    create: { email: `patientB.phase7.${runSuffix}@hospital.com`, passwordHash, role: "PATIENT" },
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
    where: { email: `doctor.phase7.${runSuffix}@hospital.com` },
    update: {},
    create: { email: `doctor.phase7.${runSuffix}@hospital.com`, passwordHash, role: "DOCTOR" },
  });

  let dept = await prisma.department.findFirst();
  if (!dept) {
    dept = await prisma.department.create({
      data: { name: "Neurology " + runSuffix, description: "Neuro Care" },
    });
  }

  const doctor = await prisma.doctor.upsert({
    where: { userId: docUser.id },
    update: {},
    create: {
      userId: docUser.id,
      name: "Dr. Stephen Strange " + runSuffix,
      specialization: "Neurology",
      departmentId: dept.id,
      phone: "9988334433",
      email: docUser.email,
    },
  });

  // Setup Receptionist
  const recUser = await prisma.user.upsert({
    where: { email: `receptionist.phase7.${runSuffix}@hospital.com` },
    update: {},
    create: { email: `receptionist.phase7.${runSuffix}@hospital.com`, passwordHash, role: "RECEPTIONIST" },
  });

  // Setup Pharmacist
  const pharmUser = await prisma.user.upsert({
    where: { email: `pharm.phase7.${runSuffix}@hospital.com` },
    update: {},
    create: { email: `pharm.phase7.${runSuffix}@hospital.com`, passwordHash, role: "PHARMACIST" },
  });

  // Setup Admin
  const adminUser = await prisma.user.upsert({
    where: { email: `admin.phase7.${runSuffix}@hospital.com` },
    update: {},
    create: { email: `admin.phase7.${runSuffix}@hospital.com`, passwordHash, role: "ADMIN" },
  });

  // Tokens
  const patAToken = jwt.sign({ id: patAUser.id, email: patAUser.email, role: "PATIENT", patientId: patientA.id }, JWT_SECRET, { expiresIn: "1h" });
  const patBToken = jwt.sign({ id: patBUser.id, email: patBUser.email, role: "PATIENT", patientId: patientB.id }, JWT_SECRET, { expiresIn: "1h" });
  const docToken = jwt.sign({ id: docUser.id, email: docUser.email, role: "DOCTOR", doctorId: doctor.id }, JWT_SECRET, { expiresIn: "1h" });
  const recToken = jwt.sign({ id: recUser.id, email: recUser.email, role: "RECEPTIONIST" }, JWT_SECRET, { expiresIn: "1h" });
  const pharmToken = jwt.sign({ id: pharmUser.id, email: pharmUser.email, role: "PHARMACIST" }, JWT_SECRET, { expiresIn: "1h" });
  const adminToken = jwt.sign({ id: adminUser.id, email: adminUser.email, role: "ADMIN" }, JWT_SECRET, { expiresIn: "1h" });

  const patAClient = axios.create({ baseURL: API_BASE, headers: { Authorization: `Bearer ${patAToken}` } });
  const patBClient = axios.create({ baseURL: API_BASE, headers: { Authorization: `Bearer ${patBToken}` } });
  const docClient = axios.create({ baseURL: API_BASE, headers: { Authorization: `Bearer ${docToken}` } });
  const recClient = axios.create({ baseURL: API_BASE, headers: { Authorization: `Bearer ${recToken}` } });
  const pharmClient = axios.create({ baseURL: API_BASE, headers: { Authorization: `Bearer ${pharmToken}` } });
  const adminClient = axios.create({ baseURL: API_BASE, headers: { Authorization: `Bearer ${adminToken}` } });

  let testPassed = 0;
  let testFailed = 0;

  // 1. Test 1: Real-time SSE Connection Handshake
  let sseHandshakeReceived = false;
  try {
    const ssePromise = new Promise<void>((resolve, reject) => {
      const sseReq = http.request(
        `http://localhost:5000/api/notifications/stream?token=${patAToken}`,
        (res) => {
          if (res.statusCode !== 200) {
            reject(new Error(`SSE connection failed with status code ${res.statusCode}`));
            return;
          }

          res.on("data", (chunk) => {
            const str = chunk.toString();
            if (str.includes("connected")) {
              sseHandshakeReceived = true;
              sseReq.destroy();
              resolve();
            }
          });
        }
      );

      sseReq.on("error", (err) => {
        reject(err);
      });

      sseReq.end();
    });

    await Promise.race([
      ssePromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error("SSE handshake timeout after 5s")), 5000)),
    ]);

    if (sseHandshakeReceived) {
      console.log("✅ TEST 1 PASSED: Real-Time SSE Stream successfully connected and received handshake");
      testPassed++;
    } else {
      console.error("❌ TEST 1 FAILED: SSE handshake event not received");
      testFailed++;
    }
  } catch (err: any) {
    console.error("❌ TEST 1 FAILED:", err.message);
    testFailed++;
  }

  // 2. Test 2: Notification Generation on Appointment Booking
  let notifAId = "";
  try {
    const slotDate = new Date("2026-11-16T10:00:00.000Z"); // Monday
    await recClient.post("/appointments", {
      patientId: patientA.id,
      doctorId: doctor.id,
      slotDateTime: slotDate.toISOString(),
      reason: "Neurological consultation",
    });

    const notifsRes = await patAClient.get("/notifications");
    const notifs = notifsRes.data.notifications || notifsRes.data;

    const bookingNotif = notifs.find((n: any) => n.type === "APPOINTMENT");

    if (bookingNotif && bookingNotif.title.includes("Appointment")) {
      notifAId = bookingNotif.id;
      console.log(`✅ TEST 2 PASSED: Appointment booking generated notification (${bookingNotif.title}) with type APPOINTMENT`);
      testPassed++;
    } else {
      console.error("❌ TEST 2 FAILED: Notification not found in patient inbox", notifsRes.data);
      testFailed++;
    }
  } catch (err: any) {
    console.error("❌ TEST 2 FAILED:", err.response?.data || err.message);
    testFailed++;
  }

  // 3. Test 3: Unread Count Endpoint
  try {
    const unreadRes = await patAClient.get("/notifications/unread-count");
    if (unreadRes.status === 200 && typeof unreadRes.data.unreadCount === "number" && unreadRes.data.unreadCount >= 1) {
      console.log(`✅ TEST 3 PASSED: GET /notifications/unread-count returned ${unreadRes.data.unreadCount} unread items`);
      testPassed++;
    } else {
      console.error("❌ TEST 3 FAILED: Invalid unread count response", unreadRes.data);
      testFailed++;
    }
  } catch (err: any) {
    console.error("❌ TEST 3 FAILED:", err.response?.data || err.message);
    testFailed++;
  }

  // 4. Test 4: Mark Single Notification As Read
  try {
    const readRes = await patAClient.put(`/notifications/${notifAId}/read`);
    if (readRes.status === 200 && readRes.data.read === true) {
      console.log(`✅ TEST 4 PASSED: Successfully marked notification ${notifAId} as read`);
      testPassed++;
    } else {
      console.error("❌ TEST 4 FAILED: Read state not updated", readRes.data);
      testFailed++;
    }
  } catch (err: any) {
    console.error("❌ TEST 4 FAILED:", err.response?.data || err.message);
    testFailed++;
  }

  // 5. Test 5: Strict Notification Ownership Isolation (Patient B cannot mark Patient A's notification read)
  try {
    await patBClient.put(`/notifications/${notifAId}/read`);
    console.error("❌ TEST 5 FAILED: Patient B was allowed to modify Patient A's notification!");
    testFailed++;
  } catch (err: any) {
    if (err.response?.status === 403) {
      console.log("✅ TEST 5 PASSED: Cross-user notification modification strictly rejected with HTTP 403 Forbidden");
      testPassed++;
    } else {
      console.error(`❌ TEST 5 FAILED: Expected 403, got ${err.response?.status}`);
      testFailed++;
    }
  }

  // 6. Test 6: Strict Notification Ownership Isolation on Deletion
  try {
    await patBClient.delete(`/notifications/${notifAId}`);
    console.error("❌ TEST 6 FAILED: Patient B was allowed to delete Patient A's notification!");
    testFailed++;
  } catch (err: any) {
    if (err.response?.status === 403) {
      console.log("✅ TEST 6 PASSED: Cross-user notification deletion strictly rejected with HTTP 403 Forbidden");
      testPassed++;
    } else {
      console.error(`❌ TEST 6 FAILED: Expected 403, got ${err.response?.status}`);
      testFailed++;
    }
  }

  // 7. Test 7: Role Notification Broadcast to Pharmacists (on Prescription Creation)
  try {
    await docClient.post("/pharmacy/prescriptions", {
      patientId: patientA.id,
      doctorId: doctor.id,
      medicines: [
        { medicineName: "Gabapentin 300mg", dosage: "300mg", frequency: "TID", duration: "14 days", quantity: 42 },
      ],
      notes: "Neuropathic pain protocol",
    });

    const pharmNotifsRes = await pharmClient.get("/notifications");
    const pharmNotifs = pharmNotifsRes.data.notifications || pharmNotifsRes.data;

    const prescNotif = pharmNotifs.find((n: any) => n.type === "PHARMACY");
    if (prescNotif) {
      console.log(`✅ TEST 7 PASSED: Pharmacist received real-time broadcast notification (${prescNotif.title})`);
      testPassed++;
    } else {
      console.error("❌ TEST 7 FAILED: Pharmacist notification not found", pharmNotifs);
      testFailed++;
    }
  } catch (err: any) {
    console.error("❌ TEST 7 FAILED:", err.response?.data || err.message);
    testFailed++;
  }

  // 8. Test 8: Laboratory & Diagnostics Real-Time Notification Triggers
  try {
    const labTest = await prisma.labTest.findFirst();
    if (labTest) {
      await docClient.post("/lab/orders", {
        patientId: patientA.id,
        labTestId: labTest.id,
        priority: "URGENT",
      });

      const patNotifsRes = await patAClient.get("/notifications");
      const patNotifs = patNotifsRes.data.notifications || patNotifsRes.data;
      const labNotif = patNotifs.find((n: any) => n.type === "LABORATORY");

      if (labNotif) {
        console.log(`✅ TEST 8 PASSED: Lab order generated real-time patient notification (${labNotif.title})`);
        testPassed++;
      } else {
        console.error("❌ TEST 8 FAILED: Lab notification not received by patient", patNotifs);
        testFailed++;
      }
    }
  } catch (err: any) {
    console.error("❌ TEST 8 FAILED:", err.response?.data || err.message);
    testFailed++;
  }

  // 9. Test 9: Mark All Notifications Read
  try {
    const markAllRes = await patAClient.put("/notifications/read-all");
    const unreadRes = await patAClient.get("/notifications/unread-count");

    if (markAllRes.status === 200 && unreadRes.data.unreadCount === 0) {
      console.log("✅ TEST 9 PASSED: PUT /notifications/read-all successfully marked all patient notifications as read (Unread count = 0)");
      testPassed++;
    } else {
      console.error("❌ TEST 9 FAILED: Unread count not 0 after mark-all-read", unreadRes.data);
      testFailed++;
    }
  } catch (err: any) {
    console.error("❌ TEST 9 FAILED:", err.response?.data || err.message);
    testFailed++;
  }

  // 10. Test 10: Delete Notification Endpoint
  try {
    const delRes = await patAClient.delete(`/notifications/${notifAId}`);
    const checkRes = await patAClient.get("/notifications");
    const remaining = (checkRes.data.notifications || checkRes.data).find((n: any) => n.id === notifAId);

    if (delRes.status === 200 && !remaining) {
      console.log(`✅ TEST 10 PASSED: Successfully deleted notification ${notifAId}`);
      testPassed++;
    } else {
      console.error("❌ TEST 10 FAILED: Notification still present after delete", checkRes.data);
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

runPhase7Tests().catch((e) => {
  console.error("Fatal Test Error:", e);
  process.exit(1);
});
