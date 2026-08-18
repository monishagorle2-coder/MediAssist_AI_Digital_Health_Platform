import { Router, Response } from "express";
import prisma from "../db";
import { AuthenticatedRequest, authenticateToken, requireRoles } from "../middlewares/auth";

const router = Router();

const HOSPITAL_HEADER = {
  name: "MediAssist Multi-Specialty Hospital & Research Center",
  tagline: "Excellence in Clinical Diagnostics & Patient Care",
  address: "100 Medical Center Boulevard, Healthcare District, Metro City, 560001",
  phone: "+1 (800) 555-MEDI / +1 (800) 555-CARE",
  email: "care@mediassist-hospital.com",
  web: "https://mediassist.hospital.internal",
  accreditation: "NABH / JCI Accredited | Reg: MED-IND-2026-9811",
};

// ====================================================================
// 1. UNIFIED EHR MEDICAL TIMELINE
// GET /api/medical-records/timeline/:patientId
// ====================================================================
router.get("/timeline/:patientId", authenticateToken as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { patientId } = req.params;
    const userRole = req.user?.role;

    // Security Ownership Check
    if (userRole === "PATIENT") {
      if (req.user?.patientId !== patientId) {
        return res.status(403).json({ error: "Forbidden: You are only authorized to view your own medical timeline" });
      }
    }

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        user: { select: { email: true } },
      },
    });

    if (!patient) {
      return res.status(404).json({ error: "Patient profile not found" });
    }

    // Fetch all patient records in parallel
    const [appointments, vitals, diagnoses, prescriptions, labOrders, bills, dischargeSummaries] = await Promise.all([
      prisma.appointment.findMany({
        where: { patientId },
        include: {
          doctor: { include: { department: true } },
        },
        orderBy: { slotDateTime: "desc" },
      }),
      prisma.vitals.findMany({
        where: { patientId },
        include: {
          appointment: {
            include: {
              doctor: { include: { department: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.diagnosisRecord.findMany({
        where: {
          patientId,
          // Hide unconfirmed draft diagnosis records from patients
          ...(userRole === "PATIENT" ? { status: "CONFIRMED" } : {}),
        },
        include: {
          doctor: { include: { department: true } },
          appointment: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.prescription.findMany({
        where: { patientId },
        include: {
          doctor: { include: { department: true } },
          appointment: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.labOrder.findMany({
        where: { patientId },
        include: {
          labTest: true,
          labResult: true,
          doctor: { include: { department: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.bill.findMany({
        where: { patientId },
        include: { billItems: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.dischargeSummary.findMany({
        where: {
          patientId,
          ...(userRole === "PATIENT" ? { status: "CONFIRMED" } : {}),
        },
        include: {
          doctor: { include: { department: true } },
          appointment: true,
        },
        orderBy: { signedAt: "desc" },
      }),
    ]);

    // Build timeline event items
    const events: any[] = [];

    // Appointments
    for (const app of appointments) {
      events.push({
        id: `app-${app.id}`,
        category: "APPOINTMENT",
        typeLabel: "Clinical Appointment",
        timestamp: app.slotDateTime,
        title: `Appointment with Dr. ${app.doctor.name}`,
        subtitle: `${app.doctor.department?.name || "General"} | Token #${app.tokenNumber || "N/A"}`,
        status: app.queueStatus || app.status,
        doctorName: app.doctor.name,
        departmentName: app.doctor.department?.name,
        summary: app.reason || "General Consultation",
        metadata: {
          appointmentId: app.id,
          tokenNumber: app.tokenNumber,
          consultationStartedAt: app.consultationStartedAt,
          consultationCompletedAt: app.consultationCompletedAt,
        },
      });
    }

    // Clinical Vitals
    for (const v of vitals) {
      events.push({
        id: `vit-${v.id}`,
        category: "VITALS",
        typeLabel: "Clinical Vitals Recorded",
        timestamp: v.createdAt,
        title: "Physiological Vitals Captured",
        subtitle: v.appointment?.doctor ? `Logged during visit with Dr. ${v.appointment.doctor.name}` : "Clinical Staff Record",
        status: "RECORDED",
        doctorName: v.appointment?.doctor?.name,
        departmentName: v.appointment?.doctor?.department?.name,
        summary: `BP: ${v.bloodPressure || "N/A"} mmHg, Pulse: ${v.pulse || "N/A"} bpm, Temp: ${v.temperature || "N/A"} °F, SpO2: ${v.spo2 || "N/A"}%`,
        metadata: {
          vitalsId: v.id,
          bloodPressure: v.bloodPressure,
          pulse: v.pulse,
          temperature: v.temperature,
          spo2: v.spo2,
          weight: v.weight,
          height: v.height,
        },
      });
    }

    // Diagnoses
    for (const d of diagnoses) {
      events.push({
        id: `diag-${d.id}`,
        category: "DIAGNOSIS",
        typeLabel: "Medical Diagnosis",
        timestamp: d.confirmedAt || d.createdAt,
        title: d.finalDiagnosis ? `Confirmed: ${d.finalDiagnosis}` : "Clinical Assessment",
        subtitle: `Dr. ${d.doctor.name} (${d.doctor.department?.name || "OPD"})`,
        status: d.status,
        doctorName: d.doctor.name,
        departmentName: d.doctor.department?.name,
        summary: `Symptoms: ${d.symptoms} | Diagnosis: ${d.finalDiagnosis || "Under Review"}`,
        metadata: {
          diagnosisRecordId: d.id,
          symptoms: d.symptoms,
          finalDiagnosis: d.finalDiagnosis,
          confirmedAt: d.confirmedAt,
          confirmedBy: d.confirmedBy,
        },
      });
    }

    // Prescriptions
    for (const p of prescriptions) {
      let medicinesCount = 0;
      try {
        const meds = typeof p.medicines === "string" ? JSON.parse(p.medicines) : p.medicines;
        medicinesCount = Array.isArray(meds) ? meds.length : 0;
      } catch (e) {
        medicinesCount = 1;
      }

      events.push({
        id: `rx-${p.id}`,
        category: "PRESCRIPTION",
        typeLabel: "Prescription Order",
        timestamp: p.createdAt,
        title: `Prescription #${p.id.slice(-6).toUpperCase()} (${medicinesCount} Medication${medicinesCount === 1 ? "" : "s"})`,
        subtitle: `Dr. ${p.doctor.name} | Status: ${p.status}`,
        status: p.status,
        doctorName: p.doctor.name,
        departmentName: p.doctor.department?.name,
        summary: p.notes ? `Instructions: ${p.notes}` : "Medications prescribed for clinical therapy",
        metadata: {
          prescriptionId: p.id,
          status: p.status,
        },
      });
    }

    // Lab Orders & Results
    for (const l of labOrders) {
      const isCompleted = l.status === "COMPLETED";
      events.push({
        id: `lab-${l.id}`,
        category: isCompleted ? "LAB_RESULT" : "LAB_ORDER",
        typeLabel: isCompleted ? "Diagnostic Lab Report Finalized" : "Lab Test Investigation Ordered",
        timestamp: isCompleted && l.completedAt ? l.completedAt : l.createdAt,
        title: `${l.labTest.name} (${l.orderNumber})`,
        subtitle: `Specimen: ${l.labTest.sampleType} | Priority: ${l.priority}`,
        status: l.status,
        doctorName: l.doctor?.name,
        departmentName: l.doctor?.department?.name,
        summary: isCompleted && l.labResult?.summary
          ? `Result: ${l.labResult.summary}`
          : `Test Status: ${l.status}. Specimen: ${l.labTest.sampleType}`,
        metadata: {
          labOrderId: l.id,
          orderNumber: l.orderNumber,
          testCode: l.labTest.code,
          priority: l.priority,
          hasResult: !!l.labResult,
        },
      });
    }

    // Billing Events
    for (const b of bills) {
      const amount = b.totalAmount ?? b.amount;
      events.push({
        id: `bill-${b.id}`,
        category: "BILLING",
        typeLabel: b.status === "PAID" || b.paymentStatus === "PAID" ? "Settled Invoice / Receipt" : "Hospital Invoice Issued",
        timestamp: b.paidAt || b.createdAt,
        title: `Invoice #${b.invoiceNumber || b.id.slice(-6).toUpperCase()} ($${amount.toFixed(2)})`,
        subtitle: `Status: ${b.paymentStatus || b.status} | Method: ${b.paymentMethod || "Pending"}`,
        status: b.paymentStatus || b.status,
        summary: `Total Amount: $${amount.toFixed(2)} | Subtotal: $${(b.subtotal ?? amount).toFixed(2)}${b.transactionReference ? ` | Ref: ${b.transactionReference}` : ""}`,
        metadata: {
          billId: b.id,
          invoiceNumber: b.invoiceNumber,
          totalAmount: amount,
          paymentStatus: b.paymentStatus || b.status,
        },
      });
    }

    // Discharge Summaries
    for (const ds of dischargeSummaries) {
      events.push({
        id: `ds-${ds.id}`,
        category: "DISCHARGE_SUMMARY",
        typeLabel: "Official Discharge Summary",
        timestamp: ds.signedAt || ds.createdAt,
        title: `Discharge Summary (${ds.summaryNumber})`,
        subtitle: `Signed by Dr. ${ds.doctor.name} (${ds.doctor.department?.name || "General"})`,
        status: ds.status,
        doctorName: ds.doctor.name,
        departmentName: ds.doctor.department?.name,
        summary: `Diagnosis: ${ds.primaryDiagnosis} | Plan: ${ds.followUpAdvice}`,
        metadata: {
          dischargeSummaryId: ds.id,
          summaryNumber: ds.summaryNumber,
          primaryDiagnosis: ds.primaryDiagnosis,
          admissionSummary: ds.admissionSummary,
          treatmentGiven: ds.treatmentGiven,
          followUpAdvice: ds.followUpAdvice,
        },
      });
    }

    // Deterministic sort: Newest event first
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Summary Statistics
    const summaryStats = {
      totalAppointments: appointments.length,
      totalDiagnoses: diagnoses.length,
      totalPrescriptions: prescriptions.length,
      totalLabTests: labOrders.length,
      completedLabReports: labOrders.filter((l) => l.status === "COMPLETED").length,
      totalBilled: bills.filter((b) => b.status !== "CANCELLED").reduce((sum, b) => sum + (b.totalAmount ?? b.amount), 0),
      totalPaid: bills.filter((b) => b.status === "PAID" || b.paymentStatus === "PAID").reduce((sum, b) => sum + (b.totalAmount ?? b.amount), 0),
      lastVisitDate: appointments.length > 0 ? appointments[0].slotDateTime : null,
    };

    res.json({
      hospital: HOSPITAL_HEADER,
      patient: {
        id: patient.id,
        name: patient.name,
        email: patient.user?.email,
        phone: patient.phone,
        dob: patient.dob,
        gender: patient.gender,
        bloodGroup: patient.bloodGroup,
        address: patient.address,
        allergies: patient.allergies,
        chronicConditions: patient.chronicConditions,
        emergencyContactName: patient.emergencyContactName,
        emergencyContactPhone: patient.emergencyContactPhone,
        insuranceProvider: patient.insuranceProvider,
        insuranceNumber: patient.insuranceNumber,
      },
      summaryStats,
      timeline: events,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to generate patient medical timeline", details: error.message });
  }
});

// ====================================================================
// 2. FORMAL DIAGNOSIS REPORT DOCUMENT
// GET /api/medical-records/diagnosis/:id/report
// ====================================================================
router.get("/diagnosis/:id/report", authenticateToken as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userRole = req.user?.role;
    const patientId = req.user?.patientId;

    const record = await prisma.diagnosisRecord.findUnique({
      where: { id },
      include: {
        patient: true,
        doctor: { include: { department: true } },
        appointment: {
          include: {
            vitals: { orderBy: { createdAt: "desc" }, take: 1 },
          },
        },
      },
    });

    if (!record) {
      return res.status(404).json({ error: "Diagnosis record not found" });
    }

    // Security Check: Patient can only view their own CONFIRMED report
    if (userRole === "PATIENT") {
      if (record.patientId !== patientId) {
        return res.status(403).json({ error: "Forbidden: You are not authorized to view this diagnosis report" });
      }
      if (record.status !== "CONFIRMED") {
        return res.status(403).json({ error: "Access Denied: This diagnosis record is pending clinician confirmation." });
      }
    }

    // Related vitals
    const latestVitals = record.appointment?.vitals?.[0] || null;

    const reportDocument = {
      hospital: HOSPITAL_HEADER,
      documentType: "CLINICAL_DIAGNOSIS_REPORT",
      reportNumber: `DIAG-${record.id.slice(-8).toUpperCase()}`,
      generatedAt: new Date().toISOString(),
      patient: {
        id: record.patient.id,
        name: record.patient.name,
        phone: record.patient.phone,
        dob: record.patient.dob,
        gender: record.patient.gender,
        bloodGroup: record.patient.bloodGroup,
        address: record.patient.address,
        allergies: record.patient.allergies || "None reported",
        chronicConditions: record.patient.chronicConditions || "None recorded",
      },
      doctor: {
        name: `Dr. ${record.doctor.name}`,
        specialization: record.doctor.specialization,
        department: record.doctor.department?.name || "General Medicine",
        email: record.doctor.email,
        phone: record.doctor.phone,
      },
      appointment: record.appointment
        ? {
            id: record.appointment.id,
            visitDate: record.appointment.slotDateTime,
            tokenNumber: record.appointment.tokenNumber,
            reason: record.appointment.reason,
          }
        : null,
      clinicalFindings: {
        chiefComplaints: record.symptoms,
        finalDiagnosis: record.finalDiagnosis || "Clinical Assessment In Progress",
        status: record.status,
        confirmedAt: record.confirmedAt || record.createdAt,
        confirmedBy: record.confirmedBy || `Dr. ${record.doctor.name}`,
      },
      vitals: latestVitals
        ? {
            bloodPressure: latestVitals.bloodPressure,
            pulse: latestVitals.pulse,
            temperature: latestVitals.temperature,
            spo2: latestVitals.spo2,
            weight: latestVitals.weight,
            height: latestVitals.height,
            recordedAt: latestVitals.createdAt,
          }
        : null,
      disclaimer: "This document is a certified medical assessment record produced and verified by the attending consultant physician. For questions, consult the department directly.",
    };

    res.json(reportDocument);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to generate diagnosis report document", details: error.message });
  }
});

// ====================================================================
// 3. FORMAL PRESCRIPTION REPORT DOCUMENT
// GET /api/medical-records/prescription/:id/report
// ====================================================================
router.get("/prescription/:id/report", authenticateToken as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userRole = req.user?.role;
    const patientId = req.user?.patientId;

    const prescription = await prisma.prescription.findUnique({
      where: { id },
      include: {
        patient: true,
        doctor: { include: { department: true } },
        diagnosisRecord: true,
        appointment: true,
      },
    });

    if (!prescription) {
      return res.status(404).json({ error: "Prescription not found" });
    }

    // Security Check
    if (userRole === "PATIENT" && prescription.patientId !== patientId) {
      return res.status(403).json({ error: "Forbidden: You are not authorized to view this prescription" });
    }

    let parsedMedicines: any[] = [];
    try {
      parsedMedicines =
        typeof prescription.medicines === "string"
          ? JSON.parse(prescription.medicines)
          : prescription.medicines;
    } catch (e) {
      parsedMedicines = [];
    }

    const prescriptionDocument = {
      hospital: HOSPITAL_HEADER,
      documentType: "PRESCRIPTION_ORDER",
      rxNumber: `RX-${prescription.id.slice(-8).toUpperCase()}`,
      prescriptionDate: prescription.createdAt,
      status: prescription.status,
      patient: {
        id: prescription.patient.id,
        name: prescription.patient.name,
        phone: prescription.patient.phone,
        dob: prescription.patient.dob,
        gender: prescription.patient.gender,
        bloodGroup: prescription.patient.bloodGroup,
        allergies: prescription.patient.allergies || "No known drug allergies",
      },
      doctor: {
        name: `Dr. ${prescription.doctor.name}`,
        specialization: prescription.doctor.specialization,
        department: prescription.doctor.department?.name || "OPD",
        email: prescription.doctor.email,
      },
      diagnosisIndication: prescription.diagnosisRecord?.finalDiagnosis || null,
      medicines: parsedMedicines.map((m: any, idx: number) => ({
        index: idx + 1,
        medicineName: m.medicineName || "Medication",
        genericName: m.genericName || null,
        dosage: m.dosage || "As directed",
        frequency: m.frequency || "Once daily",
        duration: m.duration || "5 days",
        quantity: m.quantity || 1,
        instructions: m.instructions || "Take after meals with water",
      })),
      clinicalNotes: prescription.notes || "Follow prescribed dosage regimen. In case of adverse reactions, contact hospital immediately.",
      dispensingStatus: {
        status: prescription.status,
        dispensedNotice: prescription.status === "DISPENSED" ? "Dispensed & Verified by Hospital Pharmacy" : "Pending Pharmacy Counter Dispensation",
      },
      disclaimer: "Valid only when signed by a registered medical practitioner. Medications must be stored in cool, dry conditions away from direct sunlight.",
    };

    res.json(prescriptionDocument);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to generate prescription document", details: error.message });
  }
});

// ====================================================================
// 4. FORMAL LABORATORY DIAGNOSTIC REPORT DOCUMENT
// GET /api/medical-records/lab/:id/report
// ====================================================================
router.get("/lab/:id/report", authenticateToken as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userRole = req.user?.role;
    const patientId = req.user?.patientId;

    const order = await prisma.labOrder.findFirst({
      where: {
        OR: [{ id }, { orderNumber: id }],
      },
      include: {
        patient: true,
        doctor: { include: { department: true } },
        labTest: true,
        labResult: true,
        appointment: true,
      },
    });

    if (!order) {
      return res.status(404).json({ error: "Laboratory order not found" });
    }

    // Security Check
    if (userRole === "PATIENT" && order.patientId !== patientId) {
      return res.status(403).json({ error: "Forbidden: You are not authorized to view this diagnostic report" });
    }

    let parsedParameters: any[] = [];
    if (order.labResult) {
      try {
        parsedParameters =
          typeof order.labResult.parameterResults === "string"
            ? JSON.parse(order.labResult.parameterResults)
            : order.labResult.parameterResults;
      } catch (e) {
        parsedParameters = [];
      }
    }

    const labDocument = {
      hospital: HOSPITAL_HEADER,
      documentType: "LABORATORY_DIAGNOSTIC_REPORT",
      orderNumber: order.orderNumber,
      accessionId: `ACC-${order.id.slice(-6).toUpperCase()}`,
      status: order.status,
      priority: order.priority,
      createdAt: order.createdAt,
      sampleCollectedAt: order.sampleCollectedAt,
      sampleCollectedBy: order.sampleCollectedBy,
      completedAt: order.completedAt,
      patient: {
        id: order.patient.id,
        name: order.patient.name,
        phone: order.patient.phone,
        dob: order.patient.dob,
        gender: order.patient.gender,
        bloodGroup: order.patient.bloodGroup,
      },
      doctor: order.doctor
        ? {
            name: `Dr. ${order.doctor.name}`,
            specialization: order.doctor.specialization,
            department: order.doctor.department?.name || "Clinical Pathology",
          }
        : null,
      test: {
        id: order.labTest.id,
        name: order.labTest.name,
        code: order.labTest.code,
        category: order.labTest.category,
        sampleType: order.labTest.sampleType,
        tatHours: order.labTest.tatHours,
        referenceRange: order.labTest.referenceRange,
        unit: order.labTest.unit,
      },
      result: order.labResult
        ? {
            parameters: parsedParameters.map((p: any) => ({
              parameter: p.parameter || order.labTest.name,
              value: p.value || "N/A",
              unit: p.unit || order.labTest.unit || "",
              referenceRange: p.referenceRange || order.labTest.referenceRange || "",
              flag: p.flag || "NORMAL",
            })),
            summary: order.labResult.summary,
            remarks: order.labResult.remarks || "No supplementary clinical pathology remarks.",
            testedBy: order.labResult.testedBy || order.sampleCollectedBy || "Laboratory Analyst",
            approvedBy: order.labResult.approvedBy || "Consultant Pathologist, MD",
            resultDate: order.labResult.resultDate,
          }
        : null,
      disclaimer: "These laboratory results relate specifically to the specimen submitted. Diagnostic interpretations should be correlated clinically with patient history and other findings.",
    };

    res.json(labDocument);
  } catch (error: any) {
    res.status(500).json({ error: "Failed to generate laboratory report document", details: error.message });
  }
});

export default router;
