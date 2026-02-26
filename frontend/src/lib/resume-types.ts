export interface WorkHistoryEntry {
  id: string;
  organization: string;
  position: string;
  department: string | null;
  city: string | null;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
  description: string | null;
}

export interface EducationEntry {
  id: string;
  institution: string;
  faculty: string | null;
  specialty: string | null;
  degree: string | null;
  city: string | null;
  startYear: number | null;
  endYear: number | null;
  type: string | null;
}

export interface CmeCourseEntry {
  id: string;
  courseName: string;
  provider: string | null;
  completedAt: string | null;
  hours: number | null;
  nmoPoints: number | null;
  certificateNumber: string | null;
}

export interface NoteEntry {
  id: string;
  content: string;
  authorName: string;
  createdAt: string;
}

export interface TagEntry {
  id: string;
  label: string;
  color: string | null;
}

export interface UploadedFileRef {
  id: string;
  originalName: string;
  mimeType: string;
}

export interface CandidateRow {
  id: string;
  createdAt: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  specialization: string | null;
  qualificationCategory: string;
  totalExperienceYears: number | null;
  accreditationStatus: boolean;
  accreditationExpiryDate: string | null;
  status: string;
  priority: string;
  branches: string[];
  processingStatus: string;
  processingError: string | null;
  tags: TagEntry[];
}

export interface CandidateDetail extends CandidateRow {
  birthDate: string | null;
  university: string | null;
  faculty: string | null;
  graduationYear: number | null;
  internshipPlace: string | null;
  internshipSpecialty: string | null;
  internshipYearEnd: number | null;
  residencyPlace: string | null;
  residencySpecialty: string | null;
  residencyYearEnd: number | null;
  additionalSpecializations: string[];
  certificateNumber: string | null;
  certificateExpiryDate: string | null;
  specialtyExperienceYears: number | null;
  nmoPoints: number | null;
  publications: string | null;
  languages: string[];
  additionalSkills: string | null;
  rawText: string | null;
  aiConfidence: number | null;
  uploadedFile: UploadedFileRef | null;
  workHistory: WorkHistoryEntry[];
  education: EducationEntry[];
  cmeCourses: CmeCourseEntry[];
  notes: NoteEntry[];
}

export interface FilterOptions {
  specializations: string[];
  categories: string[];
  statuses: string[];
  priorities: string[];
  branches: string[];
  cities: string[];
  workCities: string[];
  educationCities: string[];
}

export interface UploadedItem {
  id: string;
  name: string;
  size?: number;
  type: 'file' | 'text';
  processingStatus: 'PENDING' | 'EXTRACTING' | 'PARSING' | 'COMPLETED' | 'FAILED';
  candidateId?: string;
  error?: string;
}

export type PeriodPreset = '7d' | '30d' | '90d' | 'year' | 'all';

export interface KpiMetric {
  key: string;
  title: string;
  value: number;
  previousValue: number | null;
  format: 'number' | 'percent' | 'decimal' | 'fraction';
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
  conversionFromPrevious: number | null;
  color: string;
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
  expiringAccreditations: {
    id: string;
    fullName: string;
    specialization: string | null;
    accreditationExpiryDate: string | null;
  }[];
}
