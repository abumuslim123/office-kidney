import { z } from 'zod';

const WorkHistorySchema = z.object({
  organization: z.string().describe('Name of hospital, clinic, or medical institution'),
  position: z.string().describe('Job title/position held'),
  department: z.string().nullable().catch(null).describe('Department within the organization'),
  city: z.string().nullable().catch(null).describe('City where the organization is located'),
  startDate: z.string().nullable().catch(null).describe('Start date in YYYY-MM format'),
  endDate: z.string().nullable().catch(null).describe('End date in YYYY-MM format, null if current'),
  isCurrent: z.boolean().catch(false).describe('Whether the candidate currently works here'),
  description: z.string().nullable().catch(null).describe('Additional details about responsibilities'),
});

const EducationSchema = z.object({
  institution: z.string().describe('University or medical institute name'),
  faculty: z.string().nullable().catch(null).describe('Faculty name'),
  specialty: z.string().nullable().catch(null).describe('Specialty studied'),
  degree: z.string().nullable().catch(null).describe('Degree obtained'),
  city: z.string().nullable().catch(null).describe('City where the institution is located'),
  startYear: z.number().nullable().catch(null).describe('Year studies began'),
  endYear: z.number().nullable().catch(null).describe('Year of graduation/completion'),
  type: z.string().nullable().catch(null).describe('Type: higher, internship, residency, retraining, or other'),
});

const CmeCourseSchema = z.object({
  courseName: z.string().describe('Name of the CME course'),
  provider: z.string().nullable().catch(null).describe('Organization providing the course'),
  completedAt: z.string().nullable().catch(null).describe('Completion date in YYYY-MM format'),
  hours: z.number().nullable().catch(null).describe('Duration in academic hours'),
  nmoPoints: z.number().nullable().catch(null).describe('НМО points earned'),
  certificateNumber: z.string().nullable().catch(null).describe('Certificate number if available'),
});

export const CvParsedOutputSchema = z.object({
  fullName: z.string().min(1).describe('Full name (ФИО) of the candidate'),
  email: z.string().nullable().catch(null).describe('Email address'),
  phone: z.string().nullable().catch(null).describe('Phone number'),
  birthDate: z.string().nullable().catch(null).describe('Date of birth in YYYY-MM-DD format'),
  city: z.string().nullable().catch(null).describe('City of residence'),
  gender: z.enum(['MALE', 'FEMALE', 'UNKNOWN']).catch('UNKNOWN').describe('Gender inferred from name and text grammar'),
  university: z.string().nullable().catch(null).describe('Primary medical university/institute'),
  faculty: z.string().nullable().catch(null).describe('Faculty at primary university'),
  graduationYear: z.number().nullable().catch(null).describe('Year of graduation from primary university'),
  internshipPlace: z.string().nullable().catch(null).describe('Institution where интернатура was completed'),
  internshipSpecialty: z.string().nullable().catch(null).describe('Specialty of интернатура'),
  internshipYearEnd: z.number().nullable().catch(null).describe('Year интернатура was completed'),
  residencyPlace: z.string().nullable().catch(null).describe('Institution where ординатура was completed'),
  residencySpecialty: z.string().nullable().catch(null).describe('Specialty of ординатура'),
  residencyYearEnd: z.number().nullable().catch(null).describe('Year ординатура was completed'),
  specialization: z.string().nullable().catch(null).describe('Primary medical specialization'),
  additionalSpecializations: z.array(z.string()).catch([]).describe('Additional specializations'),
  qualificationCategory: z.enum(['HIGHEST', 'FIRST', 'SECOND', 'NONE']).catch('NONE').describe('Qualification category'),
  categoryAssignedDate: z.string().nullable().catch(null).describe('Date category was assigned, YYYY-MM-DD'),
  accreditationStatus: z.boolean().catch(false).describe('Whether the candidate has valid accreditation'),
  accreditationDate: z.string().nullable().catch(null).describe('Date of accreditation, YYYY-MM-DD'),
  accreditationExpiryDate: z.string().nullable().catch(null).describe('Date accreditation expires, YYYY-MM-DD'),
  certificateNumber: z.string().nullable().catch(null).describe('Specialist certificate number'),
  certificateIssueDate: z.string().nullable().catch(null).describe('Certificate issue date, YYYY-MM-DD'),
  certificateExpiryDate: z.string().nullable().catch(null).describe('Certificate expiry date, YYYY-MM-DD'),
  totalExperienceYears: z.number().nullable().catch(null).describe('Total years of medical work experience'),
  specialtyExperienceYears: z.number().nullable().catch(null).describe('Years of experience in primary specialization'),
  nmoPoints: z.number().nullable().catch(null).describe('Total accumulated НМО points'),
  publications: z.string().nullable().catch(null).describe('List of publications, as free text'),
  languages: z.array(z.string()).catch([]).describe('Languages spoken'),
  additionalSkills: z.string().nullable().catch(null).describe('Additional skills or competencies'),
  desiredSalary: z.number().nullable().catch(null).describe('Desired salary: fixed amount in rubles per month or percentage of patient visit cost'),
  desiredSalaryType: z.enum(['FIXED_RUB', 'PERCENT_OF_VISIT']).nullable().catch(null).describe('Salary type: FIXED_RUB for fixed monthly salary, PERCENT_OF_VISIT for percentage of visit cost'),
  workHistory: z.array(WorkHistorySchema).catch([]).describe('Complete work history'),
  education: z.array(EducationSchema).catch([]).describe('All education entries'),
  cmeCourses: z.array(CmeCourseSchema).catch([]).describe('Continuing medical education courses'),
});

export type CvParsedOutput = z.infer<typeof CvParsedOutputSchema>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const cvJsonSchema = z.toJSONSchema(CvParsedOutputSchema as any);

export const QualityEvaluationSchema = z.object({
  score: z.number().min(0).max(1).catch(0.5),
  issues: z.array(z.string()).catch([]),
});

export type QualityEvaluation = z.infer<typeof QualityEvaluationSchema>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const qualityJsonSchema = z.toJSONSchema(QualityEvaluationSchema as any);
