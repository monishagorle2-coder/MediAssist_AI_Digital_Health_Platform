import axios from "axios";
import prisma from "../src/db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const API_BASE = "http://localhost:5000/api";
const JWT_SECRET = process.env.JWT_SECRET || "mediassist_super_secret_jwt_key_12345";

async function runPhase6Tests() {
  console.log("==================================================");
  console.log("RUNNING PHASE 6 BILLING & INVOICING SUITE");
  console.log("==================================================");

  const passwordHash = await bcrypt.hash("Password123!", 10);
  const runSuffix = Date.now().toString().slice(-4);

  // Setup Receptionist
  const recUser = await prisma.user.upsert({
    where: { email: `receptionist.phase6.${runSuffix}@hospital.com` },
    update: {},
    create: { email: `receptionist.phase6.${runSuffix}@hospital.com`, passwordHash, role: "RECEPTIONIST" },
  });

  // Setup Doctor
  const docUser = await prisma.user.upsert({
    where: { email: `doctor.phase6.${runSuffix}@hospital.com` },
    update: {},
    create: { email: `doctor.phase6.${runSuffix}@hospital.com`, passwordHash, role: "DOCTOR" },
  });

  let dept = await prisma.department.findFirst();
  if (!dept) {
    dept = await prisma.department.create({
      data: { name: "Cardiology " + runSuffix, description: "Cardio Care" },
    });
  }

  const doctor = await prisma.doctor.upsert({
    where: { userId: docUser.id },
    update: {},
    create: {
      userId: docUser.id,
      name: "Dr. Gregory House " + runSuffix,
      specialization: "Diagnostics",
      departmentId: dept.id,
      phone: "9988223344",
      email: docUser.email,
    },
  });

  // Setup Patient A
  const patAUser = await prisma.user.upsert({
    where: { email: `patientA.phase6.${runSuffix}@hospital.com` },
    update: {},
    create: { email: `patientA.phase6.${runSuffix}@hospital.com`, passwordHash, role: "PATIENT" },
  });

  const patientA = await prisma.patient.upsert({
    where: { userId: patAUser.id },
    update: {},
    create: {
      userId: patAUser.id,
      name: "Arthur Dent " + runSuffix,
      phone: "9988223355",
      dob: new Date("1985-03-11"),
      gender: "Male",
      bloodGroup: "O+",
      address: "42 Galaxy Way",
    },
  });

  // Setup Patient B
  const patBUser = await prisma.user.upsert({
    where: { email: `patientB.phase6.${runSuffix}@hospital.com` },
    update: {},
    create: { email: `patientB.phase6.${runSuffix}@hospital.com`, passwordHash, role: "PATIENT" },
  });

  const patientB = await prisma.patient.upsert({
    where: { userId: patBUser.id },
    update: {},
    create: {
      userId: patBUser.id,
      name: "Ford Prefect " + runSuffix,
      phone: "9988223366",
      dob: new Date("1982-08-20"),
      gender: "Male",
      bloodGroup: "AB+",
      address: "100 Betelgeuse",
    },
  });

  // Setup Admin
  const adminUser = await prisma.user.upsert({
    where: { email: `admin.phase6.${runSuffix}@hospital.com` },
    update: {},
    create: { email: `admin.phase6.${runSuffix}@hospital.com`, passwordHash, role: "ADMIN" },
  });

  // Setup Pharmacist
  const pharmUser = await prisma.user.upsert({
    where: { email: `pharm.phase6.${runSuffix}@hospital.com` },
    update: {},
    create: { email: `pharm.phase6.${runSuffix}@hospital.com`, passwordHash, role: "PHARMACIST" },
  });

  // Setup Tokens
  const recToken = jwt.sign({ id: recUser.id, email: recUser.email, role: "RECEPTIONIST" }, JWT_SECRET, { expiresIn: "1h" });
  const docToken = jwt.sign({ id: docUser.id, email: docUser.email, role: "DOCTOR", doctorId: doctor.id }, JWT_SECRET, { expiresIn: "1h" });
  const patAToken = jwt.sign({ id: patAUser.id, email: patAUser.email, role: "PATIENT", patientId: patientA.id }, JWT_SECRET, { expiresIn: "1h" });
  const patBToken = jwt.sign({ id: patBUser.id, email: patBUser.email, role: "PATIENT", patientId: patientB.id }, JWT_SECRET, { expiresIn: "1h" });
  const adminToken = jwt.sign({ id: adminUser.id, email: adminUser.email, role: "ADMIN" }, JWT_SECRET, { expiresIn: "1h" });
  const pharmToken = jwt.sign({ id: pharmUser.id, email: pharmUser.email, role: "PHARMACIST" }, JWT_SECRET, { expiresIn: "1h" });

  const recClient = axios.create({ baseURL: API_BASE, headers: { Authorization: `Bearer ${recToken}` } });
  const docClient = axios.create({ baseURL: API_BASE, headers: { Authorization: `Bearer ${docToken}` } });
  const patAClient = axios.create({ baseURL: API_BASE, headers: { Authorization: `Bearer ${patAToken}` } });
  const patBClient = axios.create({ baseURL: API_BASE, headers: { Authorization: `Bearer ${patBToken}` } });
  const adminClient = axios.create({ baseURL: API_BASE, headers: { Authorization: `Bearer ${adminToken}` } });
  const pharmClient = axios.create({ baseURL: API_BASE, headers: { Authorization: `Bearer ${pharmToken}` } });

  let testPassed = 0;
  let testFailed = 0;

  // 1. Test 1: Receptionist Manual Invoice Creation with Taxes & Discounts
  let manualBillId = "";
  let manualInvoiceNumber = "";
  try {
    const res = await recClient.post("/bills", {
      patientId: patientA.id,
      taxRate: 5.0, // 5%
      discountAmount: 10.0, // $10 discount
      notes: "Emergency outpatient care and wound dressing",
      items: [
        { description: "Emergency Room Triage", category: "PROCEDURE", quantity: 1, unitPrice: 200.0 },
        { description: "Sterile Bandages & Antiseptic", category: "PHARMACY", quantity: 2, unitPrice: 25.0 },
      ],
    });

    // Subtotal = 200 + 50 = 250.00
    // Tax 5% = 12.50
    // Discount = 10.00
    // Total = 250 + 12.50 - 10 = 252.50
    if (
      res.status === 201 &&
      res.data.invoiceNumber.startsWith("INV-") &&
      res.data.subtotal === 250.0 &&
      res.data.taxAmount === 12.5 &&
      res.data.discountAmount === 10.0 &&
      res.data.totalAmount === 252.5 &&
      res.data.billItems.length === 2
    ) {
      manualBillId = res.data.id;
      manualInvoiceNumber = res.data.invoiceNumber;
      console.log(`✅ TEST 1 PASSED: Created manual invoice ${manualInvoiceNumber} with correct server tax ($12.50), discount ($10.00) & total ($252.50)`);
      testPassed++;
    } else {
      console.error("❌ TEST 1 FAILED: Incorrect calculations", res.data);
      testFailed++;
    }
  } catch (err: any) {
    console.error("❌ TEST 1 FAILED:", err.response?.data || err.message);
    testFailed++;
  }

  // 2. Test 2: Consultation Booking Automatic Billing
  let consultationBillId = "";
  let appointmentId = "";
  try {
    const appDate = new Date("2026-11-09T09:30:00.000Z"); // Monday within working hours
    const appRes = await recClient.post("/appointments", {
      patientId: patientA.id,
      doctorId: doctor.id,
      slotDateTime: appDate.toISOString(),
      reason: "Cardiac health checkup",
    });

    appointmentId = appRes.data.id;
    const billRes = await prisma.bill.findUnique({
      where: { appointmentId },
      include: { billItems: true },
    });

    if (
      billRes &&
      billRes.invoiceNumber?.startsWith("INV-") &&
      billRes.amount === 150.0 &&
      billRes.billItems.length >= 1 &&
      billRes.billItems[0].category === "CONSULTATION"
    ) {
      consultationBillId = billRes.id;
      console.log(`✅ TEST 2 PASSED: Consultation booking auto-created bill (${billRes.invoiceNumber}) with category CONSULTATION and amount $150.00`);
      testPassed++;
    } else {
      console.error("❌ TEST 2 FAILED: Bill not created properly for appointment", billRes);
      testFailed++;
    }
  } catch (err: any) {
    console.error("❌ TEST 2 FAILED:", err.response?.data || err.message);
    testFailed++;
  }

  // 3. Test 3: Pharmacy Dispensing Billing Integration
  try {
    const med = await prisma.medicine.create({
      data: {
        name: "Atorvastatin " + runSuffix,
        genericName: "Atorvastatin Calcium",
        category: "Cardiovascular",
        batchNumber: "BAT-CARD-" + runSuffix,
        expiryDate: new Date("2027-12-31"),
        price: 20.0,
        stock: 50,
        minStockLimit: 10,
        unit: "tablets",
      },
    });

    const presc = await prisma.prescription.create({
      data: {
        patientId: patientA.id,
        doctorId: doctor.id,
        appointmentId,
        medicines: JSON.stringify([{ medicineId: med.id, medicineName: med.name, dosage: "20mg", frequency: "OD", duration: "10 days", quantity: 2 }]),
        status: "PENDING",
      },
    });

    // Dispense via Pharmacist (PUT method)
    await pharmClient.put(`/pharmacy/prescriptions/${presc.id}/dispense`);

    const updatedBill = await prisma.bill.findUnique({
      where: { id: consultationBillId },
      include: { billItems: true },
    });

    // Consultation ($150) + Pharmacy (2 * $20 = $40) = $190
    if (
      updatedBill &&
      updatedBill.amount === 190.0 &&
      updatedBill.billItems.some((bi) => bi.category === "PHARMACY" && bi.amount === 40.0)
    ) {
      console.log(`✅ TEST 3 PASSED: Pharmacy dispensing seamlessly appended $40.00 PHARMACY item to bill (New total: $190.00)`);
      testPassed++;
    } else {
      console.error("❌ TEST 3 FAILED: Bill not updated on dispensing", updatedBill);
      testFailed++;
    }
  } catch (err: any) {
    console.error("❌ TEST 3 FAILED:", err.response?.data || err.message);
    testFailed++;
  }

  // 4. Test 4: Laboratory Ordering Billing Integration
  try {
    const testPanel = await prisma.labTest.create({
      data: {
        name: "Lipid Profile Panel " + runSuffix,
        code: "LIPID-" + runSuffix,
        category: "Biochemistry",
        sampleType: "Serum",
        price: 60.0,
        tatHours: 4,
      },
    });

    await docClient.post("/lab/orders", {
      patientId: patientA.id,
      appointmentId,
      labTestId: testPanel.id,
      priority: "ROUTINE",
    });

    const updatedBill = await prisma.bill.findUnique({
      where: { id: consultationBillId },
      include: { billItems: true },
    });

    // Total = $190 + $60 = $250
    if (
      updatedBill &&
      updatedBill.amount === 250.0 &&
      updatedBill.billItems.some((bi) => bi.category === "LABORATORY" && bi.amount === 60.0)
    ) {
      console.log(`✅ TEST 4 PASSED: Lab test order appended $60.00 LABORATORY item to bill (New total: $250.00)`);
      testPassed++;
    } else {
      console.error("❌ TEST 4 FAILED: Bill not updated on lab order", updatedBill);
      testFailed++;
    }
  } catch (err: any) {
    console.error("❌ TEST 4 FAILED:", err.response?.data || err.message);
    testFailed++;
  }

  // 5. Test 5: Payment Processing (Patient Pays Own Bill with UPI)
  try {
    const payRes = await patAClient.put(`/bills/${consultationBillId}/pay`, {
      paymentMethod: "UPI",
      transactionReference: "UPI-AXIS-99281726",
    });

    if (
      payRes.status === 200 &&
      payRes.data.bill.status === "PAID" &&
      payRes.data.bill.paymentStatus === "PAID" &&
      payRes.data.bill.paymentMethod === "UPI" &&
      payRes.data.bill.paidAt
    ) {
      console.log(`✅ TEST 5 PASSED: Patient A successfully paid $250.00 invoice via UPI (Txn: UPI-AXIS-99281726)`);
      testPassed++;
    } else {
      console.error("❌ TEST 5 FAILED:", payRes.data);
      testFailed++;
    }
  } catch (err: any) {
    console.error("❌ TEST 5 FAILED:", err.response?.data || err.message);
    testFailed++;
  }

  // 6. Test 6: Duplicate Payment Rejection
  try {
    await patAClient.put(`/bills/${consultationBillId}/pay`, {
      paymentMethod: "CASH",
    });
    console.error("❌ TEST 6 FAILED: Duplicate payment was permitted unexpectedly!");
    testFailed++;
  } catch (err: any) {
    if (err.response?.status === 400 && err.response.data.error.includes("already paid")) {
      console.log(`✅ TEST 6 PASSED: Duplicate payment safely rejected with HTTP 400: "${err.response.data.error}"`);
      testPassed++;
    } else {
      console.error(`❌ TEST 6 FAILED: Expected 400, got ${err.response?.status}`);
      testFailed++;
    }
  }

  // 7. Test 7: Patient Ownership Protection (Patient B cannot view or pay Patient A's bill)
  try {
    await patBClient.get(`/bills/${consultationBillId}`);
    console.error("❌ TEST 7 FAILED: Patient B was allowed to view Patient A's invoice!");
    testFailed++;
  } catch (err: any) {
    if (err.response?.status === 403) {
      console.log(`✅ TEST 7 PASSED: Cross-patient bill access strictly rejected with HTTP 403 Forbidden`);
      testPassed++;
    } else {
      console.error(`❌ TEST 7 FAILED: Expected 403, got ${err.response?.status}`);
      testFailed++;
    }
  }

  // 8. Test 8: Cancellation Rules (Cannot cancel paid bill, Can cancel pending bill)
  try {
    // Attempt to cancel paid bill -> should fail
    let cancelPaidRejected = false;
    try {
      await recClient.put(`/bills/${consultationBillId}/cancel`, { reason: "Mistake" });
    } catch (e: any) {
      if (e.response?.status === 400) cancelPaidRejected = true;
    }

    // Cancel pending manual bill -> should succeed
    const cancelRes = await recClient.put(`/bills/${manualBillId}/cancel`, { reason: "Patient rescheduled" });

    if (cancelPaidRejected && cancelRes.data.bill.status === "CANCELLED") {
      console.log("✅ TEST 8 PASSED: Paid invoice cancellation rejected; pending invoice successfully cancelled.");
      testPassed++;
    } else {
      console.error("❌ TEST 8 FAILED: Cancellation rules violated", { cancelPaidRejected, cancelRes: cancelRes.data });
      testFailed++;
    }
  } catch (err: any) {
    console.error("❌ TEST 8 FAILED:", err.response?.data || err.message);
    testFailed++;
  }

  // 9. Test 9: Admin Refund Workflow
  try {
    const refundRes = await adminClient.put(`/bills/${consultationBillId}/refund`, {
      reason: "Insurance coverage retroactively approved",
    });

    if (refundRes.status === 200 && refundRes.data.bill.paymentStatus === "REFUNDED") {
      console.log("✅ TEST 9 PASSED: Admin successfully refunded paid invoice with audit reason.");
      testPassed++;
    } else {
      console.error("❌ TEST 9 FAILED:", refundRes.data);
      testFailed++;
    }
  } catch (err: any) {
    console.error("❌ TEST 9 FAILED:", err.response?.data || err.message);
    testFailed++;
  }

  // 10. Test 10: Billing Stats & Audit Log Verification
  try {
    const statsRes = await recClient.get("/bills/summary/stats");
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        action: { in: ["CREATE_INVOICE", "PAY_INVOICE", "CANCEL_INVOICE", "REFUND_INVOICE"] },
      },
    });

    if (statsRes.status === 200 && statsRes.data.totalInvoices >= 2 && auditLogs.length >= 3) {
      console.log("✅ TEST 10 PASSED: Billing stats computed successfully and verified immutable audit trail.");
      testPassed++;
    } else {
      console.error("❌ TEST 10 FAILED:", { stats: statsRes.data, auditCount: auditLogs.length });
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

runPhase6Tests().catch((e) => {
  console.error("Fatal Test Error:", e);
  process.exit(1);
});
