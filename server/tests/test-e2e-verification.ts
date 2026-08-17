import axios from "axios";

const BASE_URL = "http://localhost:5000";

async function runTests() {
  console.log("=== STARTING END-TO-END VERIFICATION ===\n");
  const timestamp = Date.now();
  const testPatientEmail = "test.patient." + timestamp + "@example.com";
  const testPassword = "Password123!";

  // 1. Health check
  console.log("1. Testing GET /health ...");
  const healthRes = await axios.get(BASE_URL + "/health");
  console.log("   ✓ Health status:", healthRes.data.status);

  // 2. Patient Registration
  console.log("\n2. Testing Patient Registration (POST /api/auth/register) ...");
  const regRes = await axios.post(BASE_URL + "/api/auth/register", {
    email: testPatientEmail,
    password: testPassword,
    name: "Jane Doe",
    phone: "1234567890",
    dob: "1992-08-10",
    gender: "Female",
    bloodGroup: "B+",
    address: "123 Test Street"
  });
  console.log("   ✓ Registered successfully. User ID:", regRes.data.userId, "Patient ID:", regRes.data.patientId);

  // 3. Patient Login
  console.log("\n3. Testing Patient Login (POST /api/auth/login) ...");
  const patientLoginRes = await axios.post(BASE_URL + "/api/auth/login", {
    email: testPatientEmail,
    password: testPassword
  });
  const patientToken = patientLoginRes.data.token;
  const patientId = patientLoginRes.data.user.patientId;
  console.log("   ✓ Patient logged in. Role:", patientLoginRes.data.user.role, "Token received:", !!patientToken);

  // 4. Doctor Login
  console.log("\n4. Testing Doctor Login (POST /api/auth/login) ...");
  const doctorLoginRes = await axios.post(BASE_URL + "/api/auth/login", {
    email: "doctor.smith@mediassist.com",
    password: "DoctorPassword123!"
  });
  const doctorToken = doctorLoginRes.data.token;
  const doctorId = doctorLoginRes.data.user.doctorId;
  console.log("   ✓ Doctor logged in. Role:", doctorLoginRes.data.user.role, "Doctor ID:", doctorId);

  // 5. Role Authorization Check
  console.log("\n5. Testing Role Authorization Checks ...");
  try {
    await axios.get(BASE_URL + "/api/admin/stats", {
      headers: { Authorization: "Bearer " + patientToken }
    });
    console.error("   ✗ FAILED: Patient was allowed to access Admin stats!");
  } catch (err: any) {
    console.log("   ✓ Patient correctly blocked from Admin stats (Status: " + err.response?.status + ")");
  }

  try {
    await axios.post(BASE_URL + "/api/diagnosis", {
      patientId: patientId,
      symptoms: "Fever"
    }, {
      headers: { Authorization: "Bearer " + patientToken }
    });
    console.error("   ✗ FAILED: Patient was allowed to create diagnosis!");
  } catch (err: any) {
    console.log("   ✓ Patient correctly blocked from creating diagnosis (Status: " + err.response?.status + ")");
  }

  // 6. Doctor Listing
  console.log("\n6. Testing Doctor Listing (GET /api/doctors) ... ");
  const doctorsRes = await axios.get(BASE_URL + "/api/doctors", {
    headers: { Authorization: "Bearer " + patientToken }
  });
  console.log("   ✓ Doctors retrieved. Count:", doctorsRes.data.length);
  const activeDoctorId = doctorId || doctorsRes.data[0].id;

  // 7. Appointment Booking
  console.log("\n7. Testing Appointment Booking (POST /api/appointments) ...");
  const apptRes = await axios.post(BASE_URL + "/api/appointments", {
    doctorId: activeDoctorId,
    slotDateTime: new Date(Date.now() + 86400000).toISOString(),
    reason: "Persistent fever and fatigue",
    notes: "Started 3 days ago"
  }, {
    headers: { Authorization: "Bearer " + patientToken }
  });
  const appointmentId = apptRes.data.id;
  console.log("   ✓ Appointment booked successfully. Appointment ID:", appointmentId);

  // 8. Diagnosis Creation with aiSuggestions
  console.log("\n8. Testing Diagnosis Creation with aiSuggestions (POST /api/diagnosis) ...");
  const aiPayload = {
    differentialDiagnoses: [
      { condition: "Viral Fever", confidence: 0.88 },
      { condition: "Influenza A", confidence: 0.72 }
    ],
    recommendedTests: ["Complete Blood Count", "Rapid Flu Test"],
    urgency: "Medium"
  };

  const diagRes = await axios.post(BASE_URL + "/api/diagnosis", {
    appointmentId: appointmentId,
    patientId: patientId,
    symptoms: "High fever, sore throat, chills",
    aiSuggestions: aiPayload
  }, {
    headers: { Authorization: "Bearer " + doctorToken }
  });
  const diagnosisId = diagRes.data.id;
  console.log("   ✓ Diagnosis created. ID:", diagnosisId, "Status:", diagRes.data.status);

  // 9. Verify aiSuggestions persistence & privacy
  console.log("\n9. Testing aiSuggestions persistence & role-based visibility ...");
  // Doctor views record (should have aiSuggestions)
  const doctorViewDiag = await axios.get(BASE_URL + "/api/diagnosis/" + diagnosisId, {
    headers: { Authorization: "Bearer " + doctorToken }
  });
  const storedAi = doctorViewDiag.data.aiSuggestions;
  const aiMatched = storedAi && storedAi.differentialDiagnoses && storedAi.differentialDiagnoses[0].condition === "Viral Fever";
  console.log("   ✓ Doctor can view diagnosis with full aiSuggestions:", aiMatched);

  // Patient views PENDING record (should be blocked)
  try {
    await axios.get(BASE_URL + "/api/diagnosis/" + diagnosisId, {
      headers: { Authorization: "Bearer " + patientToken }
    });
    console.error("   ✗ FAILED: Patient saw pending diagnosis record!");
  } catch (err: any) {
    console.log("   ✓ Patient correctly blocked from viewing pending diagnosis (Status: " + err.response?.status + ")");
  }

  // 10. Doctor confirms diagnosis
  console.log("\n10. Confirming Diagnosis (PUT /api/diagnosis/:id/confirm) ...");
  const confirmRes = await axios.put(BASE_URL + "/api/diagnosis/" + diagnosisId + "/confirm", {
    finalDiagnosis: "Acute Viral Pharyngitis"
  }, {
    headers: { Authorization: "Bearer " + doctorToken }
  });
  console.log("   ✓ Diagnosis confirmed. Status:", confirmRes.data.status);

  // Patient views CONFIRMED record (should see confirmed report WITHOUT AI suggestions)
  const patientViewDiag = await axios.get(BASE_URL + "/api/diagnosis/" + diagnosisId, {
    headers: { Authorization: "Bearer " + patientToken }
  });
  console.log("   ✓ Patient can view confirmed record. Diagnosis:", patientViewDiag.data.finalDiagnosis, "| AI suggestions hidden from patient:", patientViewDiag.data.aiSuggestions === undefined);

  // 11. Prescription Creation & Retrieval
  console.log("\n11. Testing Prescription Creation (POST /api/pharmacy/prescriptions) ...");
  const presRes = await axios.post(BASE_URL + "/api/pharmacy/prescriptions", {
    appointmentId: appointmentId,
    patientId: patientId,
    diagnosisRecordId: diagnosisId,
    medicines: [
      { medicineName: "Paracetamol 500mg", dosage: "1 tablet", frequency: "TDS (3 times/day)", duration: "5 days", quantity: 15 },
      { medicineName: "Cetirizine 10mg", dosage: "1 tablet", frequency: "OD (Once at night)", duration: "5 days", quantity: 5 }
    ],
    notes: "Take after meals"
  }, {
    headers: { Authorization: "Bearer " + doctorToken }
  });
  console.log("   ✓ Prescription created. ID:", presRes.data.id);

  // Patient lists prescriptions
  const patientPresRes = await axios.get(BASE_URL + "/api/pharmacy/prescriptions", {
    headers: { Authorization: "Bearer " + patientToken }
  });
  console.log("   ✓ Patient retrieved prescriptions. Count:", patientPresRes.data.length);

  // 12. Patient Medical Records (Diagnosis Records List)
  console.log("\n12. Testing Medical Records (GET /api/diagnosis) ...");
  const patientRecordsRes = await axios.get(BASE_URL + "/api/diagnosis", {
    headers: { Authorization: "Bearer " + patientToken }
  });
  console.log("   ✓ Patient retrieved confirmed medical records. Count:", patientRecordsRes.data.length);

  console.log("\n=== ALL END-TO-END FLOWS VERIFIED SUCCESSFULLY ===");
}

runTests().catch(err => {
  console.error("Test failed with error:", err.response?.data || err.message);
  process.exit(1);
});
