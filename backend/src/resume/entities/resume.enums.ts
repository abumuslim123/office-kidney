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
  ONLINE_INTERVIEW = 'ONLINE_INTERVIEW',
  INTERVIEW = 'INTERVIEW',
  TRIAL = 'TRIAL',
  INTERNSHIP = 'INTERNSHIP',
  HIRED = 'HIRED',
  REJECTED = 'REJECTED',
  RESERVE = 'RESERVE',
}

export enum ResumeCandidatePriority {
  ACTIVE = 'ACTIVE',
  RESERVE = 'RESERVE',
  NOT_SUITABLE = 'NOT_SUITABLE',
  ARCHIVE = 'ARCHIVE',
  DELETED = 'DELETED',
}

export enum ResumeCandidateGender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  UNKNOWN = 'UNKNOWN',
}

export enum ResumeCandidateDoctorType {
  PEDIATRIC = 'PEDIATRIC',
  THERAPIST = 'THERAPIST',
  FAMILY = 'FAMILY',
}

export enum ResumeSalaryType {
  FIXED_RUB = 'FIXED_RUB',
  PERCENT_OF_VISIT = 'PERCENT_OF_VISIT',
}

export enum ResumeLeadStatus {
  NEW = 'NEW',
  IN_PROGRESS = 'IN_PROGRESS',
  CONTACTED = 'CONTACTED',
  CONVERTED = 'CONVERTED',
  NOT_RELEVANT = 'NOT_RELEVANT',
}
