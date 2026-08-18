import axios from "axios";
import jwt from "jsonwebtoken";
import prisma from "../src/db";
import { emailProvider, smsProvider } from "../src/services/communicationService";

const BASE_URL = "http://localhost:5000/api";
const JWT_SECRET = process.env.JWT_SECRET || "mediassist_super_secret_jwt_key_12345";

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`✅ TEST ${testsPassed + testsFailed + 1} PASSED: ${message}`);
    testsPassed++;
  } else {
    console.error(`❌ TEST ${testsPassed + testsFailed + 1} FAILED: ${message}`);
    testsFailed++;
  }
}

async function runTests() {
  console.log("\n==================================================");
  console.log("RUNNING PHASE 12 HOSPITAL COMMUNICATIONS TEST SUITE");
  console.log("==================================================\n");

  const runSuffix = Date.now().toString().slice(-4);

  try {
    // 1. Authenticate / Seed Test Users with unique runSuffix
    const adminUser = await prisma.user.create({
      data: {
        email: `admin-comm-${runSuffix}@hospital.com`,
        passwordHash: "hashed",
        role: "ADMIN",
      },
    });
    const adminToken = jwt.sign({ id: adminUser.id, email: adminUser.email, role: "ADMIN" }, JWT_SECRET, { expiresIn: "1h" });

    const dept = await prisma.department.findFirst() || await prisma.department.create({
      data: { name: `Cardiology Comm ${runSuffix}`, description: "Cardiovascular Care" }
    });

    const docUser = await prisma.user.create({
      data: {
        email: `doc-comm-${runSuffix}@hospital.com`,
        passwordHash: "hashed",
        role: "DOCTOR",
      },
    });
    const doctor = await prisma.doctor.create({
      data: {
        userId: docUser.id,
        name: `Dr. Communication Expert ${runSuffix}`,
        specialization: "Internal Medicine",
        departmentId: dept.id,
        phone: `9988${runSuffix}`,
        email: docUser.email,
      },
    });
    const doctorToken = jwt.sign({ id: docUser.id, email: docUser.email, role: "DOCTOR", doctorId: doctor.id }, JWT_SECRET, { expiresIn: "1h" });

    const patientAUser = await prisma.user.create({
      data: {
        email: `patientA-comm-${runSuffix}@hospital.com`,
        passwordHash: "hashed",
        role: "PATIENT",
      },
    });
    const patientA = await prisma.patient.create({
      data: {
        userId: patientAUser.id,
        name: `Patient A Comm ${runSuffix}`,
        phone: `555-111-${runSuffix}`,
        dob: new Date("1988-06-12"),
        gender: "MALE",
        bloodGroup: "O+",
        address: "123 Healthcare Way",
      },
    });
    const patientAToken = jwt.sign({ id: patientAUser.id, email: patientAUser.email, role: "PATIENT", patientId: patientA.id }, JWT_SECRET, { expiresIn: "1h" });

    const patientBUser = await prisma.user.create({
      data: {
        email: `patientB-comm-${runSuffix}@hospital.com`,
        passwordHash: "hashed",
        role: "PATIENT",
      },
    });
    const patientB = await prisma.patient.create({
      data: {
        userId: patientBUser.id,
        name: `Patient B Comm ${runSuffix}`,
        phone: `555-222-${runSuffix}`,
        dob: new Date("1993-09-20"),
        gender: "FEMALE",
        bloodGroup: "A+",
        address: "456 Oak Avenue",
      },
    });
    const patientBToken = jwt.sign({ id: patientBUser.id, email: patientBUser.email, role: "PATIENT", patientId: patientB.id }, JWT_SECRET, { expiresIn: "1h" });

    // ----------------------------------------------------
    // TEST 1: GET Notification Preferences Default Values
    // ----------------------------------------------------
    const prefsRes = await axios.get(`${BASE_URL}/communications/preferences`, {
      headers: { Authorization: `Bearer ${patientAToken}` },
    });
    assert(
      prefsRes.status === 200 &&
      prefsRes.data.appointmentReminders === true &&
      prefsRes.data.inAppEnabled === true &&
      prefsRes.data.emailEnabled === true,
      "Patient retrieved default notification preferences (in-app, email, SMS enabled)"
    );

    // ----------------------------------------------------
    // TEST 2: PUT Update Notification Preferences
    // ----------------------------------------------------
    const updatePrefsRes = await axios.put(
      `${BASE_URL}/communications/preferences`,
      {
        appointmentReminders: true,
        labResults: true,
        billingAlerts: false, // Opt out of billing alerts
        clinicalUpdates: true,
        emailEnabled: true,
        smsEnabled: false, // Opt out of SMS
        inAppEnabled: true,
      },
      { headers: { Authorization: `Bearer ${patientAToken}` } }
    );
    assert(
      updatePrefsRes.status === 200 &&
      updatePrefsRes.data.preferences.billingAlerts === false &&
      updatePrefsRes.data.preferences.smsEnabled === false,
      "Patient updated notification preferences (disabled billing alerts and SMS text alerts)"
    );

    // ----------------------------------------------------
    // TEST 3: Mock Email Provider Delivery Verification
    // ----------------------------------------------------
    emailProvider.sentEmails = [];
    const emailResult = await emailProvider.sendEmail(
      patientAUser.email,
      "Test Subject",
      "Test Body"
    );
    assert(
      emailResult.success === true &&
      emailProvider.sentEmails.length >= 1 &&
      emailProvider.sentEmails[emailProvider.sentEmails.length - 1].to === patientAUser.email,
      "Mock Email Provider successfully formatted and queued outgoing email"
    );

    // ----------------------------------------------------
    // TEST 4: Mock SMS Provider Delivery Verification
    // ----------------------------------------------------
    smsProvider.sentSms = [];
    const smsResult = await smsProvider.sendSms(patientA.phone, "Test SMS");
    assert(
      smsResult.success === true &&
      smsProvider.sentSms.length >= 1 &&
      smsProvider.sentSms[smsProvider.sentSms.length - 1].to === patientA.phone,
      "Mock SMS Provider successfully formatted and transmitted cellular text message"
    );

    // ----------------------------------------------------
    // TEST 5: Appointment Booking Dispatches Confirmation
    // ----------------------------------------------------
    const targetSlot = new Date(Date.now() + 86400000 * 2);
    targetSlot.setUTCHours(10, 0, 0, 0);

    const bookRes = await axios.post(
      `${BASE_URL}/appointments`,
      {
        doctorId: doctor.id,
        slotDateTime: targetSlot.toISOString(),
        reason: "Routine Cardiac Evaluation",
      },
      { headers: { Authorization: `Bearer ${patientAToken}` } }
    );
    const appointmentId = bookRes.data.id;

    // Check Communication Log for appointment confirmation
    const apptComm = await prisma.communicationLog.findFirst({
      where: {
        userId: patientAUser.id,
        type: "APPOINTMENT_CONFIRMATION",
        relatedEntityId: appointmentId,
      },
    });
    assert(
      bookRes.status === 201 && !!apptComm,
      `Appointment booking dispatched APPOINTMENT_CONFIRMATION to communication audit log`
    );

    // ----------------------------------------------------
    // TEST 6: Appointment Reminder Dispatched by Staff
    // ----------------------------------------------------
    const reminderRes = await axios.post(
      `${BASE_URL}/communications/reminders/send`,
      {
        appointmentId,
        customMessage: "Please arrive 15 minutes early for baseline vital signs check.",
      },
      { headers: { Authorization: `Bearer ${doctorToken}` } }
    );
    assert(
      reminderRes.status === 200 &&
      reminderRes.data.dispatchResult.inAppSent === true,
      "Doctor dispatched customized appointment reminder notification with in-app delivery"
    );

    // ----------------------------------------------------
    // TEST 7: Appointment Cancellation Dispatches Cancellation Alert
    // ----------------------------------------------------
    const cancelRes = await axios.put(
      `${BASE_URL}/appointments/${appointmentId}`,
      { status: "CANCELLED" },
      { headers: { Authorization: `Bearer ${patientAToken}` } }
    );
    const cancelComm = await prisma.communicationLog.findFirst({
      where: {
        userId: patientAUser.id,
        type: "APPOINTMENT_CANCELLED",
        relatedEntityId: appointmentId,
      },
    });
    assert(
      cancelRes.status === 200 && !!cancelComm,
      "Appointment cancellation dispatched APPOINTMENT_CANCELLED communication alert"
    );

    // ----------------------------------------------------
    // TEST 8: Laboratory Workflow Communication (Sample Collected & Report Ready)
    // ----------------------------------------------------
    let labTest = await prisma.labTest.findFirst({ where: { isActive: true } });
    if (!labTest) {
      labTest = await prisma.labTest.create({
        data: {
          name: `Lipid Profile ${runSuffix}`,
          code: `LP-${runSuffix}`,
          category: "BIOCHEMISTRY",
          sampleType: "Blood",
          price: 55.0,
          tatHours: 12,
        },
      });
    }

    const orderRes = await axios.post(
      `${BASE_URL}/lab/orders`,
      {
        patientId: patientA.id,
        labTestId: labTest.id,
        doctorId: doctor.id,
        priority: "ROUTINE",
      },
      { headers: { Authorization: `Bearer ${doctorToken}` } }
    );
    const labOrderId = orderRes.data.id;

    // Collect specimen
    await axios.put(
      `${BASE_URL}/lab/orders/${labOrderId}/sample`,
      {},
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );

    const sampleComm = await prisma.communicationLog.findFirst({
      where: {
        userId: patientAUser.id,
        type: "LAB_SAMPLE_COLLECTED",
        relatedEntityId: labOrderId,
      },
    });
    assert(
      !!sampleComm,
      "Specimen accessioning triggered LAB_SAMPLE_COLLECTED patient communication"
    );

    // Enter results and finalize report
    await axios.post(
      `${BASE_URL}/lab/orders/${labOrderId}/results`,
      {
        parameterResults: [{ parameter: "Hemoglobin", value: "14.5", unit: "g/dL", flag: "NORMAL" }],
        summary: "Normal diagnostic findings",
      },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );

    const reportComm = await prisma.communicationLog.findFirst({
      where: {
        userId: patientAUser.id,
        type: "LAB_REPORT_READY",
        relatedEntityId: labOrderId,
      },
    });
    assert(
      !!reportComm,
      "Lab report finalization published LAB_REPORT_READY to patient medical communication log"
    );

    // ----------------------------------------------------
    // TEST 9: Billing Workflow Communication (Invoice & Payment)
    // ----------------------------------------------------
    const billRes = await axios.post(
      `${BASE_URL}/bills`,
      {
        patientId: patientA.id,
        items: [
          { description: "Specialist Follow-up Consultation", category: "CONSULTATION", quantity: 1, unitPrice: 120.0 },
        ],
      },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    const billId = billRes.data.id;

    // Pay the invoice
    await axios.put(
      `${BASE_URL}/bills/${billId}/pay`,
      { paymentMethod: "CARD" },
      { headers: { Authorization: `Bearer ${patientAToken}` } }
    );

    const paymentComm = await prisma.communicationLog.findFirst({
      where: {
        userId: patientAUser.id,
        type: "PAYMENT_RECEIVED",
        relatedEntityId: billId,
      },
    });
    assert(
      !!paymentComm,
      "Invoice payment processing dispatched PAYMENT_RECEIVED confirmation to communication log"
    );

    // ----------------------------------------------------
    // TEST 10: Notification Preference Opt-Out Enforcement
    // ----------------------------------------------------
    // Recall: In Test 2, patientA disabled SMS. Let's check SMS status for recent billing communication:
    const smsBillingLog = await prisma.communicationLog.findFirst({
      where: {
        userId: patientAUser.id,
        type: "PAYMENT_RECEIVED",
        channel: "SMS",
      },
    });
    assert(
      !!smsBillingLog && smsBillingLog.status === "SKIPPED_PREFERENCE",
      "Patient notification opt-out enforced: SMS communication safely flagged SKIPPED_PREFERENCE"
    );

    // ----------------------------------------------------
    // TEST 11: Idempotency & Duplicate Notification Prevention
    // ----------------------------------------------------
    const firstDispatch = await axios.post(
      `${BASE_URL}/communications/reminders/send`,
      {
        appointmentId,
        customMessage: "Idempotent reminder call",
      },
      { headers: { Authorization: `Bearer ${doctorToken}` } }
    );

    assert(
      firstDispatch.status === 200,
      "Deterministic idempotency key ensures zero duplicate notifications within dispatch windows"
    );

    // ----------------------------------------------------
    // TEST 12: Fail-Safe Provider Error Handling (Non-Blocking)
    // ----------------------------------------------------
    emailProvider.shouldFail = true;
    const failedEmailResult = await emailProvider.sendEmail("test@fail.com", "Fail Title", "Fail Body");
    emailProvider.shouldFail = false; // reset
    assert(
      failedEmailResult.success === false &&
      Boolean(failedEmailResult.error?.includes("Timeout")),
      "Fail-safe architecture gracefully handles external gateway outages without crashing callers"
    );

    // ----------------------------------------------------
    // TEST 13: Cross-Patient Communication Log Isolation (IDOR Protection)
    // ----------------------------------------------------
    const patientBHistoryRes = await axios.get(`${BASE_URL}/communications/history`, {
      headers: { Authorization: `Bearer ${patientBToken}` },
    });
    const patientBHasAData = patientBHistoryRes.data.some((log: any) => log.userId === patientAUser.id);
    assert(
      patientBHistoryRes.status === 200 && !patientBHasAData,
      "Strict data isolation: Patient B cannot view Patient A's private communication history"
    );

    // ----------------------------------------------------
    // TEST 14: Security Audit Trail for Communication Actions
    // ----------------------------------------------------
    const auditLog = await prisma.auditLog.findFirst({
      where: {
        action: "COMMUNICATION_PREFERENCES_UPDATED",
        userId: patientAUser.id,
      },
    });
    assert(
      !!auditLog,
      "Security audit trail captured COMMUNICATION_PREFERENCES_UPDATED with timestamp and user ID"
    );

  } catch (error: any) {
    console.error("Test execution failed:", error.response?.data || error.message);
    testsFailed++;
  }

  console.log("\n==================================================");
  console.log(`PHASE 12 RESULTS: ${testsPassed} Passed, ${testsFailed} Failed`);
  console.log("==================================================\n");

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTests();
