export type Role = 'PATIENT' | 'DOCTOR' | 'RECEPTIONIST' | 'PHARMACIST' | 'ADMIN';

export type AppointmentStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED';
export type DiagnosisStatus = 'PENDING' | 'CONFIRMED';
export type PrescriptionStatus = 'PENDING' | 'DISPENSED';
export type BillStatus = 'PENDING' | 'PAID';

export interface User {
  id: string;
  email: string;
  role: Role;
  createdAt: string;
  patient?: Patient;
  doctor?: Doctor;
}

export interface Patient {
  id: string;
  userId: string;
  name: string;
  phone: string;
  dob: string;
  gender: string;
  bloodGroup: string;
  address: string;
}

export interface Doctor {
  id: string;
  userId: string;
  name: string;
  specialization: string;
  departmentId: string;
  phone: string;
  email: string;
  department?: Department;
}

export interface Department {
  id: string;
  name: string;
  description: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  slotDateTime: string;
  status: AppointmentStatus;
  reason: string;
  notes?: string;
  patient?: Patient;
  doctor?: Doctor;
  diagnosisRecord?: DiagnosisRecord;
  prescription?: Prescription;
  bill?: Bill;
}

export interface DifferentialDiagnosisItem {
  disease: string;
  confidence: number;
  reasoning: string;
  urgency: string;
}

export interface AiSuggestions {
  differentialDiagnosis: DifferentialDiagnosisItem[];
  recommendedTests: string[];
  clinicalSummary: string;
}

export interface DiagnosisRecord {
  id: string;
  appointmentId?: string;
  patientId: string;
  doctorId: string;
  symptoms: string;
  aiSuggestions: AiSuggestions;
  finalDiagnosis?: string;
  status: DiagnosisStatus;
  confirmedBy?: string;
  confirmedAt?: string;
  createdAt: string;
  patient?: Patient;
  doctor?: Doctor;
}

export interface MedicineItem {
  medicineId: string;
  medicineName: string;
  dosage: string;
  frequency: string;
  duration: string;
}

export interface Prescription {
  id: string;
  appointmentId?: string;
  patientId: string;
  doctorId: string;
  diagnosisRecordId?: string;
  status: PrescriptionStatus;
  medicines: MedicineItem[];
  notes?: string;
  createdAt: string;
  patient?: Patient;
  doctor?: Doctor;
}

export interface Medicine {
  id: string;
  name: string;
  category: string;
  stock: number;
  unit: string;
  minStockLimit: number;
  price: number;
}

export interface BillItem {
  description: string;
  cost: number;
}

export interface Bill {
  id: string;
  appointmentId?: string;
  patientId: string;
  amount: number;
  status: BillStatus;
  items: BillItem[];
  paidAt?: string;
  createdAt: string;
  patient?: Patient;
}

export interface AuditLog {
  id: string;
  userId?: string;
  user?: User;
  action: string;
  details: string;
  ipAddress?: string;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}
