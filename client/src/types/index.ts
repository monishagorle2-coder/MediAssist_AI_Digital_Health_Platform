export type Role = 'PATIENT' | 'DOCTOR' | 'RECEPTIONIST' | 'PHARMACIST' | 'LAB_TECHNICIAN' | 'ADMIN';

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
  allergies?: string;
  chronicConditions?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  insuranceProvider?: string;
  insuranceNumber?: string;
  vitals?: Vitals[];
}

export interface Vitals {
  id: string;
  patientId: string;
  appointmentId?: string;
  bloodPressure?: string;
  pulse?: number;
  temperature?: number;
  spo2?: number;
  weight?: number;
  height?: number;
  bmi?: number;
  recordedBy?: string;
  createdAt: string;
  updatedAt?: string;
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

export type QueueStatus = 'WAITING' | 'CHECKED_IN' | 'IN_CONSULTATION' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  slotDateTime: string;
  status: AppointmentStatus;
  queueStatus?: QueueStatus;
  tokenNumber?: number;
  checkedInAt?: string;
  consultationStartedAt?: string;
  consultationCompletedAt?: string;
  waitingMinutes?: number;
  reason: string;
  notes?: string;
  patient?: Patient;
  doctor?: Doctor;
  diagnosisRecord?: DiagnosisRecord;
  prescription?: Prescription;
  bill?: Bill;
  vitals?: Vitals[];
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
  genericName?: string;
  category: string;
  manufacturer?: string;
  batchNumber?: string;
  expiryDate?: string;
  stock: number;
  unit: string;
  minStockLimit: number;
  price: number;
  createdAt?: string;
  updatedAt?: string;
  isExpired?: boolean;
  isNearExpiry?: boolean;
  isLowStock?: boolean;
  daysUntilExpiry?: number;
}

export type PaymentMethod = 'CASH' | 'CARD' | 'UPI' | 'INSURANCE';
export type PaymentStatus = 'PENDING' | 'PAID' | 'PARTIALLY_PAID' | 'CANCELLED' | 'REFUNDED';
export type BillItemCategory = 'CONSULTATION' | 'PHARMACY' | 'LABORATORY' | 'PROCEDURE' | 'OTHER';

export interface BillItem {
  id?: string;
  billId?: string;
  description: string;
  category?: BillItemCategory | string;
  quantity?: number;
  unitPrice?: number;
  amount?: number;
  cost?: number;
}

export interface Bill {
  id: string;
  invoiceNumber?: string;
  appointmentId?: string;
  patientId: string;
  amount: number;
  subtotal?: number;
  taxRate?: number;
  taxAmount?: number;
  discountAmount?: number;
  totalAmount?: number;
  status: BillStatus | string;
  paymentStatus: PaymentStatus | string;
  paymentMethod?: PaymentMethod | string;
  paidAt?: string;
  transactionReference?: string;
  notes?: string;
  items: BillItem[] | any;
  billItems?: BillItem[];
  createdAt: string;
  updatedAt?: string;
  patient?: Patient;
  appointment?: Appointment;
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

export type LabOrderStatus = 'ORDERED' | 'SAMPLE_COLLECTED' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED';
export type LabPriority = 'ROUTINE' | 'URGENT' | 'STAT';

export interface LabTest {
  id: string;
  name: string;
  code: string;
  category: string;
  description?: string;
  sampleType: string;
  price: number;
  tatHours: number;
  referenceRange?: string;
  unit?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ParameterResultItem {
  parameter: string;
  value: string;
  unit: string;
  referenceRange: string;
  flag: 'NORMAL' | 'HIGH' | 'LOW' | 'ABNORMAL';
}

export interface LabResult {
  id: string;
  labOrderId: string;
  parameterResults: ParameterResultItem[];
  summary: string;
  remarks?: string;
  testedBy?: string;
  approvedBy?: string;
  resultDate: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LabOrder {
  id: string;
  orderNumber: string;
  patientId: string;
  doctorId: string;
  appointmentId?: string;
  diagnosisRecordId?: string;
  labTestId: string;
  status: LabOrderStatus;
  priority: LabPriority;
  clinicalNotes?: string;
  sampleCollectedAt?: string;
  sampleCollectedBy?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt?: string;
  patient?: Patient;
  doctor?: Doctor;
  appointment?: Appointment;
  diagnosisRecord?: DiagnosisRecord;
  labTest?: LabTest;
  labResult?: LabResult;
}
