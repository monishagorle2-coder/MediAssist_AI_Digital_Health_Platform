import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding started...");

  // Clear existing data
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.bill.deleteMany();
  await prisma.prescription.deleteMany();
  await prisma.diagnosisRecord.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.medicine.deleteMany();
  await prisma.doctor.deleteMany();
  await prisma.department.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.user.deleteMany();

  console.log("Existing records cleared.");

  // Password hashes
  const adminHash = await bcrypt.hash("AdminPassword123!", 10);
  const receptionistHash = await bcrypt.hash("ReceptionPassword123!", 10);
  const pharmacistHash = await bcrypt.hash("PharmacyPassword123!", 10);
  const doctorHash = await bcrypt.hash("DoctorPassword123!", 10);
  const patientHash = await bcrypt.hash("PatientPassword123!", 10);

  // 1. Create Departments
  const cardio = await prisma.department.create({
    data: {
      name: "Cardiology",
      description: "Diagnosis and treatment of heart and vascular disorders."
    }
  });

  const general = await prisma.department.create({
    data: {
      name: "General Medicine",
      description: "Primary care, prevention, and treatment of general adult health conditions."
    }
  });

  const peds = await prisma.department.create({
    data: {
      name: "Pediatrics",
      description: "Specialized clinical care for children, infants, and adolescents."
    }
  });

  console.log("Departments created.");

  // 2. Create Admin
  const adminUser = await prisma.user.create({
    data: {
      email: "admin@mediassist.com",
      passwordHash: adminHash,
      role: "ADMIN"
    }
  });

  // 3. Create Receptionist
  const receptionistUser = await prisma.user.create({
    data: {
      email: "receptionist@mediassist.com",
      passwordHash: receptionistHash,
      role: "RECEPTIONIST"
    }
  });

  // 4. Create Pharmacist
  const pharmacistUser = await prisma.user.create({
    data: {
      email: "pharmacist@mediassist.com",
      passwordHash: pharmacistHash,
      role: "PHARMACIST"
    }
  });

  console.log("Staff users created.");

  // 5. Create Doctors
  const docSmithUser = await prisma.user.create({
    data: {
      email: "doctor.smith@mediassist.com",
      passwordHash: doctorHash,
      role: "DOCTOR"
    }
  });

  const docSmith = await prisma.doctor.create({
    data: {
      userId: docSmithUser.id,
      name: "Dr. Alistair Smith",
      specialization: "Interventional Cardiology",
      departmentId: cardio.id,
      phone: "1234567890",
      email: "doctor.smith@mediassist.com",
      schedule: JSON.stringify({
        monday: ["09:00", "10:00", "11:00", "14:00", "15:00"],
        wednesday: ["09:00", "10:00", "11:00", "14:00", "15:00"],
        friday: ["09:00", "10:00", "11:00"]
      })
    }
  });

  const docJonesUser = await prisma.user.create({
    data: {
      email: "doctor.jones@mediassist.com",
      passwordHash: doctorHash,
      role: "DOCTOR"
    }
  });

  const docJones = await prisma.doctor.create({
    data: {
      userId: docJonesUser.id,
      name: "Dr. Helen Jones",
      specialization: "Family Health & Preventative Medicine",
      departmentId: general.id,
      phone: "0987654321",
      email: "doctor.jones@mediassist.com",
      schedule: JSON.stringify({
        tuesday: ["09:00", "10:00", "11:00", "14:00", "15:00"],
        thursday: ["09:00", "10:00", "11:00", "14:00", "15:00"]
      })
    }
  });

  console.log("Doctors created.");

  // 6. Create Patients
  const patientUser = await prisma.user.create({
    data: {
      email: "patient@mediassist.com",
      passwordHash: patientHash,
      role: "PATIENT"
    }
  });

  const patient = await prisma.patient.create({
    data: {
      userId: patientUser.id,
      name: "John Doe",
      phone: "5551234567",
      dob: new Date("1988-06-15"),
      gender: "Male",
      bloodGroup: "O+",
      address: "123 Maple Street, New York, NY"
    }
  });

  console.log("Patient created.");

  // 7. Create Medicines
  const medicines = [
    { name: "Paracetamol", category: "Analgesic", stock: 100, unit: "tablets", minStockLimit: 20, price: 1.5 },
    { name: "Amoxicillin", category: "Antibiotic", stock: 50, unit: "tablets", minStockLimit: 15, price: 12.0 },
    { name: "Metformin", category: "Antidiabetic", stock: 80, unit: "tablets", minStockLimit: 10, price: 8.5 },
    { name: "Ibuprofen", category: "NSAID", stock: 5, unit: "tablets", minStockLimit: 15, price: 3.0 }, // Low stock test
    { name: "Atorvastatin", category: "Cardiovascular", stock: 60, unit: "tablets", minStockLimit: 10, price: 15.0 },
    { name: "Ambroxol Cough Syrup", category: "Antitussive", stock: 15, unit: "bottles", minStockLimit: 5, price: 6.2 }
  ];

  for (const med of medicines) {
    await prisma.medicine.create({ data: med });
  }

  console.log("Medicine inventory seeded.");

  // 8. Create some initial appointments
  const appDate = new Date();
  appDate.setDate(appDate.getDate() + 1); // Tomorrow
  appDate.setHours(10, 0, 0, 0);

  const app1 = await prisma.appointment.create({
    data: {
      patientId: patient.id,
      doctorId: docJones.id,
      slotDateTime: appDate,
      reason: "Experiencing persistent abdominal bloating and moderate nausea after dinners for the past week.",
      status: "PENDING"
    }
  });

  // Create Bill for appointment
  await prisma.bill.create({
    data: {
      appointmentId: app1.id,
      patientId: patient.id,
      amount: 150.0,
      status: "PENDING",
      items: JSON.stringify([{ description: "General Consultation Fee", cost: 150.0 }])
    }
  });

  console.log("Initial appointments seeded.");

  // 9. Add Audit logs
  await prisma.auditLog.create({
    data: {
      action: "SYSTEM_SEED",
      details: "Database successfully seeded with hospital, staff, patient, and medicine master data."
    }
  });

  console.log("Seeding complete successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
