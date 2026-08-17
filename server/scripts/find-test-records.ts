import prisma from "../src/db";

async function main() {
  console.log("=== SCANNING FOR E2E TEST RECORDS ===");
  
  // Find test patients (email starts with test.patient or created in recent tests)
  const testUsers = await prisma.user.findMany({
    where: {
      OR: [
        { email: { startsWith: "test.patient" } }
      ]
    },
    include: {
      patient: {
        include: {
          appointments: {
            include: {
              diagnosisRecord: true,
              prescription: true,
              bill: true
            }
          },
          diagnosisRecords: true,
          prescriptions: true,
          bills: true
        }
      }
    }
  });

  console.log("Found Test Users/Patients:", testUsers.length);
  for (const u of testUsers) {
    console.log(`\nUser ID: ${u.id}`);
    console.log(`Email: ${u.email}`);
    console.log(`Patient ID: ${u.patient?.id} (Name: ${u.patient?.name})`);
    
    if (u.patient?.appointments?.length) {
      console.log(`  Appointments (${u.patient.appointments.length}):`);
      for (const a of u.patient.appointments) {
        console.log(`    - Appointment ID: ${a.id} (Status: ${a.status}, Reason: "${a.reason}")`);
      }
    }

    if (u.patient?.diagnosisRecords?.length) {
      console.log(`  Diagnosis Records (${u.patient.diagnosisRecords.length}):`);
      for (const d of u.patient.diagnosisRecords) {
        console.log(`    - Diagnosis ID: ${d.id} (Status: ${d.status}, Final Diagnosis: "${d.finalDiagnosis}")`);
      }
    }

    if (u.patient?.prescriptions?.length) {
      console.log(`  Prescriptions (${u.patient.prescriptions.length}):`);
      for (const p of u.patient.prescriptions) {
        console.log(`    - Prescription ID: ${p.id} (Status: ${p.status})`);
      }
    }

    if (u.patient?.bills?.length) {
      console.log(`  Bills (${u.patient.bills.length}):`);
      for (const b of u.patient.bills) {
        console.log(`    - Bill ID: ${b.id} (Amount: $${b.amount}, Status: ${b.status})`);
      }
    }
  }
}

main().finally(() => prisma.$disconnect());
