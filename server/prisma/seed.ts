import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const password = await bcrypt.hash('DoctorPassword123!', 10)
  const patientPassword = await bcrypt.hash('PatientPassword123!', 10)
  const adminPassword = await bcrypt.hash('AdminPassword123!', 10)
  const receptionPassword = await bcrypt.hash('ReceptionPassword123!', 10)
  const pharmacyPassword = await bcrypt.hash('PharmacyPassword123!', 10)

  // Create Doctor User
  const doctorUser = await prisma.user.upsert({
    where: { email: 'doctor.smith@mediassist.com' },
    update: {},
    create: {
      email: 'doctor.smith@mediassist.com',
      passwordHash: password,
      role: 'DOCTOR',
      doctor: {
        create: {
          name: 'Dr. Smith',
          specialization: 'General Medicine',
          phone: '9876543210',
          email: 'doctor.smith@mediassist.com',
          department: {
            create: {
              name: 'General Medicine',
              description: 'General healthcare department'
            }
          }
        }
      }
    }
  })

  // Create Patient User
  await prisma.user.upsert({
    where: { email: 'patient@mediassist.com' },
    update: {},
    create: {
      email: 'patient@mediassist.com',
      passwordHash: patientPassword,
      role: 'PATIENT',
      patient: {
        create: {
          name: 'John Patient',
          phone: '9876543211',
          dob: new Date('1995-05-15'),
          gender: 'Male',
          bloodGroup: 'O+',
          address: 'Hyderabad'
        }
      }
    }
  })

  // Create Admin User
  await prisma.user.upsert({
    where: { email: 'admin@mediassist.com' },
    update: {},
    create: {
      email: 'admin@mediassist.com',
      passwordHash: adminPassword,
      role: 'ADMIN'
    }
  })

  // Create Receptionist
  await prisma.user.upsert({
    where: { email: 'receptionist@mediassist.com' },
    update: {},
    create: {
      email: 'receptionist@mediassist.com',
      passwordHash: receptionPassword,
      role: 'RECEPTIONIST'
    }
  })

  // Create Pharmacist
  await prisma.user.upsert({
    where: { email: 'pharmacist@mediassist.com' },
    update: {},
    create: {
      email: 'pharmacist@mediassist.com',
      passwordHash: pharmacyPassword,
      role: 'PHARMACIST'
    }
  })

  console.log('Demo users created successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })