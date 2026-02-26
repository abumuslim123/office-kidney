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
