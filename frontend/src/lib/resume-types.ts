export enum ResumeProcessingStatus {
  PENDING = 'PENDING',
  EXTRACTING = 'EXTRACTING',
  PARSING = 'PARSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum ResumeQualificationCategory {
  HIGHEST = 'HIGHEST',
  FIRST = 'FIRST',
  SECOND = 'SECOND',
  NONE = 'NONE',
}

export enum ResumeCandidateStatus {
  NEW = 'NEW',
  REVIEWING = 'REVIEWING',
  INVITED = 'INVITED',
  HIRED = 'HIRED',
}

export enum ResumeCandidatePriority {
  ACTIVE = 'ACTIVE',
  RESERVE = 'RESERVE',
  NOT_SUITABLE = 'NOT_SUITABLE',
  ARCHIVE = 'ARCHIVE',
  DELETED = 'DELETED',
}

export interface ResumeUploadedFile {
  id: string;
  createdAt: string;
  originalName: string;
  storedPath: string;
  mimeType: string;
  sizeBytes: number;
}

export interface ResumeWorkHistory {
  id: string;
  organization: string;
  position: string;
  department: string | null;
  city: string | null;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
  description: string | null;
  candidateId: string;
}

export interface ResumeEducation {
  id: string;
  institution: string;
  faculty: string | null;
  specialty: string | null;
  degree: string | null;
  city: string | null;
  startYear: number | null;
  endYear: number | null;
  type: string | null;
  candidateId: string;
}

export interface ResumeCmeCourse {
  id: string;
  courseName: string;
  provider: string | null;
  completedAt: string | null;
  hours: number | null;
  nmoPoints: number | null;
  certificateNumber: string | null;
  candidateId: string;
}

export interface ResumeCandidateNote {
  id: string;
  createdAt: string;
  updatedAt: string;
  content: string;
  authorName: string;
  candidateId: string;
}

export interface ResumeCandidateTag {
  id: string;
  label: string;
  color: string | null;
  candidateId: string;
}

export interface ResumeCandidate {
  id: string;
  createdAt: string;
  updatedAt: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  birthDate: string | null;
  city: string | null;
  university: string | null;
  faculty: string | null;
  graduationYear: number | null;
  internshipPlace: string | null;
  internshipSpecialty: string | null;
  internshipYearEnd: number | null;
  residencyPlace: string | null;
  residencySpecialty: string | null;
  residencyYearEnd: number | null;
  specialization: string | null;
  additionalSpecializations: string[];
  qualificationCategory: ResumeQualificationCategory;
  categoryAssignedDate: string | null;
  categoryExpiryDate: string | null;
  accreditationStatus: boolean;
  accreditationDate: string | null;
  accreditationExpiryDate: string | null;
  certificateNumber: string | null;
  certificateIssueDate: string | null;
  certificateExpiryDate: string | null;
  totalExperienceYears: number | null;
  specialtyExperienceYears: number | null;
  nmoPoints: number | null;
  publications: string | null;
  languages: string[];
  additionalSkills: string | null;
  branches: string[];
  status: ResumeCandidateStatus;
  priority: ResumeCandidatePriority;
  processingStatus: ResumeProcessingStatus;
  processingError: string | null;
  rawText: string | null;
  aiConfidence: number | null;
  uploadedFileId: string | null;
  uploadedFile?: ResumeUploadedFile;
  workHistory?: ResumeWorkHistory[];
  education?: ResumeEducation[];
  cmeCourses?: ResumeCmeCourse[];
  notes?: ResumeCandidateNote[];
  tags?: ResumeCandidateTag[];
}

// Analytics types
export interface KpiMetric {
  key: string;
  title: string;
  value: number;
  previousValue: number | null;
  format: 'number' | 'decimal' | 'percent' | 'fraction';
  fractionTotal?: number;
  icon: string;
  color: string;
  trendDirection: 'up-good' | 'up-bad' | 'neutral';
}

export interface TimelinePoint {
  month: string;
  label: string;
  count: number;
}

export interface FunnelStage {
  name: string;
  value: number;
  color: string;
  conversionFromPrevious: number | null;
}

export interface BranchDistributionItem {
  branch: string;
  NEW: number;
  REVIEWING: number;
  INVITED: number;
  HIRED: number;
  total: number;
}

export interface BranchCoverageRow {
  specialization: string;
  branches: Record<string, number>;
  total: number;
}

export interface TagCount {
  label: string;
  count: number;
  color: string | null;
}

export interface CategoryItem {
  name: string;
  key: string;
  count: number;
  percentage: number;
}

export interface AnalyticsData {
  kpis: KpiMetric[];
  timeline: TimelinePoint[];
  funnel: FunnelStage[];
  specializations: { name: string; count: number }[];
  categories: CategoryItem[];
  experienceBuckets: { name: string; count: number }[];
  branchDistribution: BranchDistributionItem[];
  branchCoverage: BranchCoverageRow[];
  topTags: TagCount[];
  expiringAccreditations: { id: string; fullName: string; specialization: string | null; accreditationExpiryDate: string }[];
}
