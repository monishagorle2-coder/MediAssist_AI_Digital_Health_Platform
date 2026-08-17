import axios from "axios";
import prisma from "../src/db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const API_BASE = "http://localhost:5000/api";
const JWT_SECRET = process.env.JWT_SECRET || "fallback_super_secret_jwt_key_2026";

async function runPhase4Tests() {
  console.log("==================================================");
  console.log("RUNNING PHASE 4 PHARMACY INVENTORY & EXPIRY SUITE");
  console.log("==================================================");

  const passwordHash = await bcrypt.hash("Password123!", 10);

  // Setup Users
  const pharmUser = await prisma.user.upsert({
    where: { email: "pharmacist.phase4@hospital.com" },
    update: {},
    create: { email: "pharmacist.phase4@hospital.com", passwordHash, role: "PHARMACIST" }
  });

  const docUser = await prisma.user.upsert({
    where: { email: "doctor.phase4@hospital.com" },
    update: {},
    create: { email: "doctor.phase4@hospital.com", passwordHash, role: "DOCTOR" }
  });

  let dept = await prisma.department.findFirst();
  if (!dept) {
    dept = await prisma.department.create({
      data: { name: "General Care " + Date.now(), description: "Primary Care" }
    });
  }

  const doctor = await prisma.doctor.upsert({
    where: { userId: docUser.id },
    update: {},
    create: {
      userId: docUser.id,
      name: "Dr. Marcus Vance",
      specialization: "General Physician",
      departmentId: dept.id,
      phone: "9988776611",
      email: "doctor.phase4@hospital.com"
    }
  });

  const patUser = await prisma.user.upsert({
    where: { email: "patient.phase4@hospital.com" },
    update: {},
    create: { email: "patient.phase4@hospital.com", passwordHash, role: "PATIENT" }
  });

  const patient = await prisma.patient.upsert({
    where: { userId: patUser.id },
    update: {},
    create: {
      userId: patUser.id,
      name: "Daniel Craig",
      phone: "9988776622",
      dob: new Date("1985-06-12"),
      gender: "Male",
      bloodGroup: "O+",
      address: "10 Downing Street"
    }
  });

  const pharmToken = jwt.sign({ id: pharmUser.id, email: pharmUser.email, role: "PHARMACIST" }, JWT_SECRET, { expiresIn: "1h" });
  const docToken = jwt.sign({ id: docUser.id, email: docUser.email, role: "DOCTOR", doctorId: doctor.id }, JWT_SECRET, { expiresIn: "1h" });

  const pharmClient = axios.create({ baseURL: API_BASE, headers: { Authorization: `Bearer ${pharmToken}` } });
  const docClient = axios.create({ baseURL: API_BASE, headers: { Authorization: `Bearer ${docToken}` } });

  let testPassed = 0;
  let testFailed = 0;

  // Create Test Medicines
  const runSuffix = Date.now().toString().slice(-4);
  const futureExp = new Date();
  futureExp.setFullYear(futureExp.getFullYear() + 2); // 2 years in future

  const pastExp = new Date();
  pastExp.setDate(pastExp.getDate() - 10); // 10 days expired

  const nearExp = new Date();
  nearExp.setDate(nearExp.getDate() + 15); // expires in 15 days

  // 1. Valid Normal Medicine
  const medValid = await prisma.medicine.create({
    data: {
      name: `Amoxicillin-${runSuffix}`,
      genericName: "Amoxicillin Trihydrate",
      category: "Antibiotic",
      manufacturer: "Pfizer",
      batchNumber: `AMX-${runSuffix}`,
      expiryDate: futureExp,
      stock: 100,
      unit: "capsules",
      minStockLimit: 20,
      price: 2.50
    }
  });

  // 2. Low Stock Medicine
  const medLowStock = await prisma.medicine.create({
    data: {
      name: `Paracetamol-${runSuffix}`,
      genericName: "Acetaminophen",
      category: "Analgesic",
      manufacturer: "GSK",
      batchNumber: `PCM-${runSuffix}`,
      expiryDate: futureExp,
      stock: 5, // <= minStockLimit 15
      unit: "tablets",
      minStockLimit: 15,
      price: 0.50
    }
  });

  // 3. Expired Medicine
  const medExpired = await prisma.medicine.create({
    data: {
      name: `ExpiredSyrup-${runSuffix}`,
      genericName: "Cough Formulation",
      category: "Antitussive",
      manufacturer: "Abbott",
      batchNumber: `EXP-${runSuffix}`,
      expiryDate: pastExp,
      stock: 50,
      unit: "bottles",
      minStockLimit: 10,
      price: 8.00
    }
  });

  // 4. Near Expiry Medicine
  const medNearExpiry = await prisma.medicine.create({
    data: {
      name: `NearExpiryDrops-${runSuffix}`,
      genericName: "Ophthalmic Solution",
      category: "Ophthalmic",
      manufacturer: "Novartis",
      batchNumber: `NEX-${runSuffix}`,
      expiryDate: nearExp,
      stock: 40,
      unit: "vials",
      minStockLimit: 10,
      price: 12.00
    }
  });

  // Test 1: Low-Stock and Near-Expiry Detection via Inventory API & Summary
  try {
    const summaryRes = await pharmClient.get("/pharmacy/inventory/summary");
    const lowStockList = await pharmClient.get("/pharmacy/inventory?filter=LOW_STOCK");
    const nearExpiryList = await pharmClient.get("/pharmacy/inventory?filter=NEAR_EXPIRY");
    const expiredList = await pharmClient.get("/pharmacy/inventory?filter=EXPIRED");

    const foundLowStock = lowStockList.data.some((m: any) => m.id === medLowStock.id);
    const foundNearExp = nearExpiryList.data.some((m: any) => m.id === medNearExpiry.id);
    const foundExpired = expiredList.data.some((m: any) => m.id === medExpired.id);

    if (summaryRes.status === 200 && foundLowStock && foundNearExp && foundExpired) {
      console.log(`✅ TEST 1 PASSED: Low-Stock, Near-Expiry, and Expired filters accurately categorized inventory`);
      testPassed++;
    } else {
      console.error("❌ TEST 1 FAILED: Categorization mismatch", { summary: summaryRes.data, foundLowStock, foundNearExp, foundExpired });
      testFailed++;
    }
  } catch (err: any) {
    console.error("❌ TEST 1 FAILED:", err.response?.data || err.message);
    testFailed++;
  }

  // Test 2: Normal Dispensing & Atomic Stock Deduction
  let validPrescriptionId = "";
  try {
    const presRes = await docClient.post("/pharmacy/prescriptions", {
      patientId: patient.id,
      medicines: [
        {
          medicineId: medValid.id,
          medicineName: medValid.name,
          dosage: "500mg",
          frequency: "TID",
          duration: "5 days",
          quantity: 15
        }
      ],
      notes: "Take with food"
    });
    validPrescriptionId = presRes.data.id;

    // Dispense
    const dispenseRes = await pharmClient.put(`/pharmacy/prescriptions/${validPrescriptionId}/dispense`);
    const refetchedMed = await prisma.medicine.findUnique({ where: { id: medValid.id } });

    if (dispenseRes.status === 200 && refetchedMed && refetchedMed.stock === 85) {
      console.log(`✅ TEST 2 PASSED: Normal dispensing succeeded. Stock deducted from 100 to 85.`);
      testPassed++;
    } else {
      console.error("❌ TEST 2 FAILED: Dispensing error or stock mismatch", { res: dispenseRes.data, stock: refetchedMed?.stock });
      testFailed++;
    }
  } catch (err: any) {
    console.error("❌ TEST 2 FAILED:", err.response?.data || err.message);
    testFailed++;
  }

  // Test 3: Insufficient Stock Rejection
  try {
    const presInsufficientRes = await docClient.post("/pharmacy/prescriptions", {
      patientId: patient.id,
      medicines: [
        {
          medicineId: medLowStock.id,
          medicineName: medLowStock.name,
          dosage: "650mg",
          frequency: "PRN",
          duration: "3 days",
          quantity: 20 // Available is only 5
        }
      ]
    });

    await pharmClient.put(`/pharmacy/prescriptions/${presInsufficientRes.data.id}/dispense`);
    console.error("❌ TEST 3 FAILED: Insufficient stock dispensing was allowed unexpectedly!");
    testFailed++;
  } catch (err: any) {
    if (err.response?.status === 400 && err.response.data.error.includes("Insufficient stock")) {
      console.log(`✅ TEST 3 PASSED: Insufficient stock rejected with HTTP 400: "${err.response.data.error}"`);
      testPassed++;
    } else {
      console.error(`❌ TEST 3 FAILED: Expected 400 Insufficient stock, got ${err.response?.status}:`, err.response?.data);
      testFailed++;
    }
  }

  // Test 4: Expired Medicine Rejection
  try {
    const presExpiredRes = await docClient.post("/pharmacy/prescriptions", {
      patientId: patient.id,
      medicines: [
        {
          medicineId: medExpired.id,
          medicineName: medExpired.name,
          dosage: "10ml",
          frequency: "TID",
          duration: "5 days",
          quantity: 2
        }
      ]
    });

    await pharmClient.put(`/pharmacy/prescriptions/${presExpiredRes.data.id}/dispense`);
    console.error("❌ TEST 4 FAILED: Expired medicine dispensing was allowed unexpectedly!");
    testFailed++;
  } catch (err: any) {
    if (err.response?.status === 400 && err.response.data.error.includes("EXPIRED")) {
      console.log(`✅ TEST 4 PASSED: Expired medicine rejected with HTTP 400: "${err.response.data.error}"`);
      testPassed++;
    } else {
      console.error(`❌ TEST 4 FAILED: Expected 400 Expired error, got ${err.response?.status}:`, err.response?.data);
      testFailed++;
    }
  }

  // Test 5: Edit Medicine Details & Expiry Update API
  try {
    const updatedNewBatch = `BAT-UPDATED-${runSuffix}`;
    const newFutureExp = new Date();
    newFutureExp.setFullYear(newFutureExp.getFullYear() + 3);

    const editRes = await pharmClient.put(`/pharmacy/inventory/${medValid.id}`, {
      batchNumber: updatedNewBatch,
      expiryDate: newFutureExp.toISOString().split("T")[0],
      price: 3.25,
      manufacturer: "Pfizer Global"
    });

    if (editRes.status === 200 && editRes.data.batchNumber === updatedNewBatch && editRes.data.price === 3.25) {
      console.log(`✅ TEST 5 PASSED: Medicine catalog & batch details updated via PUT /inventory/:id`);
      testPassed++;
    } else {
      console.error("❌ TEST 5 FAILED:", editRes.data);
      testFailed++;
    }
  } catch (err: any) {
    console.error("❌ TEST 5 FAILED:", err.response?.data || err.message);
    testFailed++;
  }

  // Test 6: Concurrent Dispensing Protection
  try {
    // Create fresh medicine with stock = 20
    const medConcurrent = await prisma.medicine.create({
      data: {
        name: `ConcurrentMed-${runSuffix}`,
        category: "Sedative",
        expiryDate: futureExp,
        stock: 20,
        unit: "tablets",
        minStockLimit: 5,
        price: 4.00
      }
    });

    // Create 3 prescriptions requesting 10 each (total 30, only 20 available)
    const [p1, p2, p3] = await Promise.all([
      docClient.post("/pharmacy/prescriptions", {
        patientId: patient.id,
        medicines: [{ medicineId: medConcurrent.id, medicineName: medConcurrent.name, dosage: "10mg", frequency: "OD", duration: "1d", quantity: 10 }]
      }),
      docClient.post("/pharmacy/prescriptions", {
        patientId: patient.id,
        medicines: [{ medicineId: medConcurrent.id, medicineName: medConcurrent.name, dosage: "10mg", frequency: "OD", duration: "1d", quantity: 10 }]
      }),
      docClient.post("/pharmacy/prescriptions", {
        patientId: patient.id,
        medicines: [{ medicineId: medConcurrent.id, medicineName: medConcurrent.name, dosage: "10mg", frequency: "OD", duration: "1d", quantity: 10 }]
      }),
    ]);

    // Attempt to dispense all 3 concurrently
    const results = await Promise.allSettled([
      pharmClient.put(`/pharmacy/prescriptions/${p1.data.id}/dispense`),
      pharmClient.put(`/pharmacy/prescriptions/${p2.data.id}/dispense`),
      pharmClient.put(`/pharmacy/prescriptions/${p3.data.id}/dispense`),
    ]);

    const succeeded = results.filter(r => r.status === "fulfilled").length;
    const failed = results.filter(r => r.status === "rejected").length;
    const finalMed = await prisma.medicine.findUnique({ where: { id: medConcurrent.id } });

    // Exactly 2 must succeed (20 stock / 10 = 2), 1 must fail, final stock must be 0
    if (succeeded === 2 && failed === 1 && finalMed?.stock === 0) {
      console.log(`✅ TEST 6 PASSED: Concurrent dispensing safely handled (2 succeeded, 1 rejected for insufficient stock, final stock = 0)`);
      testPassed++;
    } else {
      console.error(`❌ TEST 6 FAILED: Concurrent race condition! Succeeded: ${succeeded}, Failed: ${failed}, Final stock: ${finalMed?.stock}`);
      testFailed++;
    }
  } catch (err: any) {
    console.error("❌ TEST 6 FAILED:", err.response?.data || err.message);
    testFailed++;
  }

  console.log("==================================================");
  console.log(`RESULTS: ${testPassed} Passed, ${testFailed} Failed`);
  console.log("==================================================");

  if (testFailed > 0) {
    process.exit(1);
  }
}

runPhase4Tests().catch((e) => {
  console.error("Fatal Test Error:", e);
  process.exit(1);
});
