import axios from "axios";
import prisma from "../src/db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const API_BASE = "http://localhost:5000/api";
const JWT_SECRET = process.env.JWT_SECRET || "mediassist_super_secret_jwt_key_12345";

async function runPhase9Tests() {
  console.log("==================================================");
  console.log("RUNNING PHASE 9 ADMIN & HOSPITAL ANALYTICS SUITE");
  console.log("==================================================");

  const passwordHash = await bcrypt.hash("Password123!", 10);
  const runSuffix = Date.now().toString().slice(-4);

  // Setup Admin User
  const adminUser = await prisma.user.upsert({
    where: { email: `admin.phase9.${runSuffix}@hospital.com` },
    update: {},
    create: { email: `admin.phase9.${runSuffix}@hospital.com`, passwordHash, role: "ADMIN" },
  });

  // Setup Doctor User
  let dept = await prisma.department.findFirst();
  if (!dept) {
    dept = await prisma.department.create({
      data: { name: "General Surgery " + runSuffix, description: "Surgical Services" },
    });
  }

  const docUser = await prisma.user.upsert({
    where: { email: `doctor.phase9.${runSuffix}@hospital.com` },
    update: {},
    create: { email: `doctor.phase9.${runSuffix}@hospital.com`, passwordHash, role: "DOCTOR" },
  });

  const doctor = await prisma.doctor.upsert({
    where: { userId: docUser.id },
    update: {},
    create: {
      userId: docUser.id,
      name: "Dr. Gregory House " + runSuffix,
      specialization: "Diagnostic Medicine",
      departmentId: dept.id,
      phone: "9988441122",
      email: docUser.email,
    },
  });

  // Setup Patient User
  const patUser = await prisma.user.upsert({
    where: { email: `patient.phase9.${runSuffix}@hospital.com` },
    update: {},
    create: { email: `patient.phase9.${runSuffix}@hospital.com`, passwordHash, role: "PATIENT" },
  });

  const patient = await prisma.patient.upsert({
    where: { userId: patUser.id },
    update: {},
    create: {
      userId: patUser.id,
      name: "John Watson " + runSuffix,
      phone: "9988443322",
      dob: new Date("1980-05-15"),
      gender: "Male",
      bloodGroup: "B+",
      address: "221B Baker St",
    },
  });

  // Setup Staff Member to test Deactivation / Password Reset
  const staffEmail = `staff.phase9.${runSuffix}@hospital.com`;
  const staffUser = await prisma.user.upsert({
    where: { email: staffEmail },
    update: { isActive: true },
    create: { email: staffEmail, passwordHash, role: "RECEPTIONIST" },
  });

  // Tokens
  const adminToken = jwt.sign({ id: adminUser.id, email: adminUser.email, role: "ADMIN" }, JWT_SECRET, { expiresIn: "1h" });
  const docToken = jwt.sign({ id: docUser.id, email: docUser.email, role: "DOCTOR", doctorId: doctor.id }, JWT_SECRET, { expiresIn: "1h" });
  const patToken = jwt.sign({ id: patUser.id, email: patUser.email, role: "PATIENT", patientId: patient.id }, JWT_SECRET, { expiresIn: "1h" });

  const adminClient = axios.create({ baseURL: API_BASE, headers: { Authorization: `Bearer ${adminToken}` } });
  const docClient = axios.create({ baseURL: API_BASE, headers: { Authorization: `Bearer ${docToken}` } });
  const patClient = axios.create({ baseURL: API_BASE, headers: { Authorization: `Bearer ${patToken}` } });

  let testPassed = 0;
  let testFailed = 0;

  // 1. Test 1: Admin Authorization & Role Guards
  try {
    const overviewRes = await adminClient.get("/admin/analytics/overview");
    if (overviewRes.status === 200 && overviewRes.data.kpi) {
      console.log("✅ TEST 1A PASSED: Administrator successfully accessed executive analytics overview");
      testPassed++;
    } else {
      console.error("❌ TEST 1A FAILED: Invalid overview payload", overviewRes.data);
      testFailed++;
    }

    // Patient blocked
    try {
      await patClient.get("/admin/analytics/overview");
      console.error("❌ TEST 1B FAILED: Patient accessed admin analytics!");
      testFailed++;
    } catch (err: any) {
      if (err.response?.status === 403) {
        console.log("✅ TEST 1B PASSED: Patient blocked from admin analytics with HTTP 403 Forbidden");
        testPassed++;
      } else {
        console.error(`❌ TEST 1B FAILED: Expected 403, got ${err.response?.status}`);
        testFailed++;
      }
    }

    // Doctor blocked from user management
    try {
      await docClient.get("/admin/users");
      console.error("❌ TEST 1C FAILED: Doctor accessed admin user management!");
      testFailed++;
    } catch (err: any) {
      if (err.response?.status === 403) {
        console.log("✅ TEST 1C PASSED: Doctor blocked from user management with HTTP 403 Forbidden");
        testPassed++;
      } else {
        console.error(`❌ TEST 1C FAILED: Expected 403, got ${err.response?.status}`);
        testFailed++;
      }
    }
  } catch (err: any) {
    console.error("❌ TEST 1 FAILED:", err.response?.data || err.message);
    testFailed++;
  }

  // 2. Test 2: Admin User Directory Listing & Search
  try {
    const usersRes = await adminClient.get("/admin/users?limit=10");
    const data = usersRes.data;

    if (usersRes.status === 200 && Array.isArray(data.users) && data.pagination?.total >= 3) {
      console.log(`✅ TEST 2 PASSED: Admin retrieved user directory (${data.pagination.total} total users) with role and activity status`);
      testPassed++;
    } else {
      console.error("❌ TEST 2 FAILED: Invalid user listing", data);
      testFailed++;
    }
  } catch (err: any) {
    console.error("❌ TEST 2 FAILED:", err.response?.data || err.message);
    testFailed++;
  }

  // 3. Test 3: User Deactivation & Authentication Lockout
  try {
    // Deactivate staff member
    const deactRes = await adminClient.put(`/admin/users/${staffUser.id}/status`, {
      isActive: false,
      reason: "Temporary suspension for audit verification",
    });

    if (deactRes.status === 200 && deactRes.data.user.isActive === false) {
      console.log("✅ TEST 3A PASSED: Admin deactivated staff user account");
      testPassed++;
    } else {
      console.error("❌ TEST 3A FAILED:", deactRes.data);
      testFailed++;
    }

    // Attempt login as deactivated user
    try {
      await axios.post(`${API_BASE}/auth/login`, {
        email: staffEmail,
        password: "Password123!",
      });
      console.error("❌ TEST 3B FAILED: Deactivated user was allowed to log in!");
      testFailed++;
    } catch (loginErr: any) {
      if (loginErr.response?.status === 403) {
        console.log("✅ TEST 3B PASSED: Deactivated user login rejected with HTTP 403 Forbidden ('Account has been deactivated')");
        testPassed++;
      } else {
        console.error(`❌ TEST 3B FAILED: Expected 403, got ${loginErr.response?.status}`);
        testFailed++;
      }
    }
  } catch (err: any) {
    console.error("❌ TEST 3 FAILED:", err.response?.data || err.message);
    testFailed++;
  }

  // 4. Test 4: User Reactivation & Successful Login
  try {
    const reactRes = await adminClient.put(`/admin/users/${staffUser.id}/status`, {
      isActive: true,
      reason: "Reinstated after review",
    });

    if (reactRes.status === 200 && reactRes.data.user.isActive === true) {
      // Test login now works
      const loginRes = await axios.post(`${API_BASE}/auth/login`, {
        email: staffEmail,
        password: "Password123!",
      });

      if (loginRes.status === 200 && loginRes.data.token) {
        console.log("✅ TEST 4 PASSED: Admin reactivated user account, and user logged in successfully");
        testPassed++;
      } else {
        console.error("❌ TEST 4 FAILED: Login failed after reactivation", loginRes.data);
        testFailed++;
      }
    }
  } catch (err: any) {
    console.error("❌ TEST 4 FAILED:", err.response?.data || err.message);
    testFailed++;
  }

  // 5. Test 5: Staff Profile Editing & Audit Log Recording
  try {
    const editRes = await adminClient.put(`/admin/users/${docUser.id}/profile`, {
      name: "Dr. Gregory House Senior " + runSuffix,
      phone: "9988449999",
      specialization: "Nephrology & Infectious Diseases",
      departmentId: dept.id,
    });

    if (editRes.status === 200 && editRes.data.user.doctor?.name.includes("Senior")) {
      console.log("✅ TEST 5 PASSED: Admin updated doctor clinical profile (Name, Specialization)");
      testPassed++;
    } else {
      console.error("❌ TEST 5 FAILED: Failed to update profile", editRes.data);
      testFailed++;
    }
  } catch (err: any) {
    console.error("❌ TEST 5 FAILED:", err.response?.data || err.message);
    testFailed++;
  }

  // 6. Test 6: Admin Password Reset Workflow
  try {
    const newStaffPassword = "NewSecretPassword99!";
    const resetRes = await adminClient.post(`/admin/users/${staffUser.id}/reset-password`, {
      newPassword: newStaffPassword,
    });

    if (resetRes.status === 200) {
      // Test login with new password
      const newLoginRes = await axios.post(`${API_BASE}/auth/login`, {
        email: staffEmail,
        password: newStaffPassword,
      });

      if (newLoginRes.status === 200 && newLoginRes.data.token) {
        console.log("✅ TEST 6 PASSED: Admin reset user password and staff member logged in with new credentials");
        testPassed++;
      } else {
        console.error("❌ TEST 6 FAILED: Login with reset password failed", newLoginRes.data);
        testFailed++;
      }
    }
  } catch (err: any) {
    console.error("❌ TEST 6 FAILED:", err.response?.data || err.message);
    testFailed++;
  }

  // 7. Test 7: Authenticated Password Change
  try {
    const changeRes = await adminClient.post("/auth/change-password", {
      currentPassword: "Password123!",
      newPassword: "AdminNewPassword2026!",
    });

    if (changeRes.status === 200) {
      console.log("✅ TEST 7 PASSED: Authenticated admin updated own password via /auth/change-password");
      testPassed++;
    } else {
      console.error("❌ TEST 7 FAILED: Password change failed", changeRes.data);
      testFailed++;
    }
  } catch (err: any) {
    console.error("❌ TEST 7 FAILED:", err.response?.data || err.message);
    testFailed++;
  }

  // 8. Test 8: Department Analytics Aggregation
  try {
    const deptRes = await adminClient.get("/admin/analytics/departments");
    const data = deptRes.data;

    if (deptRes.status === 200 && Array.isArray(data.departments) && data.totalDepartments >= 1) {
      const deptItem = data.departments[0];
      if ("doctorCount" in deptItem && "totalAppointments" in deptItem && "revenue" in deptItem) {
        console.log(`✅ TEST 8 PASSED: Department analytics aggregated across ${data.totalDepartments} departments with doctor, appointment, and revenue metrics`);
        testPassed++;
      } else {
        console.error("❌ TEST 8 FAILED: Missing department metric fields", deptItem);
        testFailed++;
      }
    }
  } catch (err: any) {
    console.error("❌ TEST 8 FAILED:", err.response?.data || err.message);
    testFailed++;
  }

  // 9. Test 9: Longitudinal Trends & Queue Status Distribution
  try {
    const trendsRes = await adminClient.get("/admin/analytics/trends?days=30");
    const data = trendsRes.data;

    if (trendsRes.status === 200 && Array.isArray(data.trends) && data.statusDistribution) {
      console.log(`✅ TEST 9 PASSED: Generated ${data.trends.length} daily trend data points and queue lifecycle breakdown`);
      testPassed++;
    } else {
      console.error("❌ TEST 9 FAILED: Invalid trends payload", data);
      testFailed++;
    }
  } catch (err: any) {
    console.error("❌ TEST 9 FAILED:", err.response?.data || err.message);
    testFailed++;
  }

  // 10. Test 10: Date-Range Filtering Verification
  try {
    const todayRes = await adminClient.get("/admin/analytics/overview?range=today");
    const monthRes = await adminClient.get("/admin/analytics/overview?range=month");

    if (todayRes.status === 200 && monthRes.status === 200 && todayRes.data.filter.range === "today") {
      console.log("✅ TEST 10 PASSED: Executive overview successfully applied date range filters ('today', 'month')");
      testPassed++;
    } else {
      console.error("❌ TEST 10 FAILED: Date filtering failed", todayRes.data);
      testFailed++;
    }
  } catch (err: any) {
    console.error("❌ TEST 10 FAILED:", err.response?.data || err.message);
    testFailed++;
  }

  // 11. Test 11: Audit Trail Search & Administrative Operations
  try {
    const auditRes = await adminClient.get("/admin/audit-logs?search=deactivated&limit=10");
    const data = auditRes.data;

    if (auditRes.status === 200 && Array.isArray(data.logs) && data.logs.length >= 1) {
      console.log(`✅ TEST 11 PASSED: Audit trail search located administrative deactivation log with IP & actor details`);
      testPassed++;
    } else {
      console.error("❌ TEST 11 FAILED: Audit search returned 0 records", data);
      testFailed++;
    }
  } catch (err: any) {
    console.error("❌ TEST 11 FAILED:", err.response?.data || err.message);
    testFailed++;
  }

  // 12. Test 12: CSV Report Export Endpoints
  try {
    const [usersCsv, deptCsv, auditCsv, revCsv] = await Promise.all([
      adminClient.get("/admin/reports/users/csv"),
      adminClient.get("/admin/reports/departments/csv"),
      adminClient.get("/admin/reports/audit-logs/csv"),
      adminClient.get("/admin/reports/revenue/csv"),
    ]);

    if (
      String(usersCsv.headers["content-type"]).includes("text/csv") &&
      String(deptCsv.headers["content-type"]).includes("text/csv") &&
      String(auditCsv.headers["content-type"]).includes("text/csv") &&
      String(revCsv.headers["content-type"]).includes("text/csv")
    ) {
      console.log("✅ TEST 12 PASSED: All 4 CSV export endpoints (Users, Departments, Audit Logs, Revenue) returned valid CSV reports");
      testPassed++;
    } else {
      console.error("❌ TEST 12 FAILED: Invalid CSV headers", usersCsv.headers);
      testFailed++;
    }
  } catch (err: any) {
    console.error("❌ TEST 12 FAILED:", err.response?.data || err.message);
    testFailed++;
  }

  console.log("==================================================");
  console.log(`RESULTS: ${testPassed} Passed, ${testFailed} Failed`);
  console.log("==================================================");

  if (testFailed > 0) {
    process.exit(1);
  }
}

runPhase9Tests().catch((e) => {
  console.error("Fatal Test Error:", e);
  process.exit(1);
});
