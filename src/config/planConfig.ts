import { PlanType, FeatureKey } from '@/types/subscription';

/**
 * קונפיגורציה של חבילה
 * כל הערכים הם read-only - אין אפשרות לשנות בצד לקוח
 */
export interface PlanConfig {
  readonly label: string;
  readonly track: 'user' | 'premium';
  readonly maxAnalysesPerMonth: number; // -1 = ללא הגבלה
  readonly maxMinutesPerMonth: number;
  readonly maxVideoMinutes: number;
  readonly maxVideoMB: number;
  readonly maxStudents?: number;
  readonly maxExperts: number; // מספר מקסימלי של מומחים שניתן לבחור
  readonly maxTracks: number; // מספר מקסימלי של תחומים (tracks) זמינים
  readonly features: Readonly<Record<FeatureKey, boolean>>;
}

/**
 * חבילות פעילות - רק אלה זמינות כרגע
 */
export const ACTIVE_PLANS: ReadonlyArray<PlanType> = [
  'trial',
  'creators',
  'creators_extreme',
] as const;

/**
 * חבילות מושבתות - לא זמינות כרגע
 */
export const DISABLED_PLANS: ReadonlyArray<PlanType> = [
  'coach',
  'coach_pro',
] as const;

/**
 * קונפיגורציה מרכזית של כל החבילות
 * Single Source of Truth - כל השינויים נעשים כאן בלבד
 * הקונפיג הוא read-only כדי למנוע שינויים בצד לקוח
 */
export const PLAN_CONFIG: Readonly<Record<PlanType, PlanConfig>> = {
  trial: {
    label: 'ניסיון',
    track: 'user',
    maxAnalysesPerMonth: 1,
    maxMinutesPerMonth: 1,
    maxVideoMinutes: 1,
    maxVideoMB: 10,
    maxExperts: 3, // עד 3 מומחים
    maxTracks: 1, // רק תחום אחד
    features: {
      pdf_export: false,
      advanced_analysis: false,
      compare_videos: false,
      student_dashboard: false,
      students_management: false,
      backup_restore: false,
      progress_tracking: false,
      analysis_history: false,
    },
  },

  creators: {
    label: 'יוצרים',
    track: 'user',
    maxAnalysesPerMonth: 10,
    maxMinutesPerMonth: 30,
    maxVideoMinutes: 3,
    maxVideoMB: 15,
    maxExperts: 8, // כל המומחים (8)
    maxTracks: 1, // רק תחום אחד
    features: {
      pdf_export: true,
      advanced_analysis: false,
      compare_videos: false,
      student_dashboard: false,
      students_management: false,
      backup_restore: false,
      progress_tracking: true,
      analysis_history: true,
    },
  },

  creators_extreme: {
    label: 'יוצרים באקסטרים',
    track: 'user',
    maxAnalysesPerMonth: 30,
    maxMinutesPerMonth: 100,
    maxVideoMinutes: 5,
    maxVideoMB: 20, // 20MB לפי הדרישות
    maxExperts: 8, // כל המומחים (8)
    maxTracks: 4, // כל התחומים (4)
    features: {
      pdf_export: true,
      advanced_analysis: true,
      compare_videos: true,
      student_dashboard: false,
      students_management: false,
      backup_restore: false,
      progress_tracking: true,
      analysis_history: true,
    },
  },

  coach: {
    label: 'מאמנים וסוכנויות',
    track: 'premium',
    maxAnalysesPerMonth: -1,
    maxMinutesPerMonth: 200,
    maxVideoMinutes: 5,
    maxVideoMB: 40,
    maxStudents: 10,
    maxExperts: 8,
    maxTracks: 4,
    features: {
      pdf_export: true,
      advanced_analysis: true,
      compare_videos: true,
      student_dashboard: true,
      students_management: true,
      backup_restore: true,
      progress_tracking: true,
      analysis_history: true,
    },
  },

  coach_pro: {
    label: 'מאמנים וסוכנויות PRO',
    track: 'premium',
    maxAnalysesPerMonth: -1,
    maxMinutesPerMonth: 300,
    maxVideoMinutes: 5,
    maxVideoMB: 40,
    maxStudents: 30,
    maxExperts: 8,
    maxTracks: 4,
    features: {
      pdf_export: true,
      advanced_analysis: true,
      compare_videos: true,
      student_dashboard: true,
      students_management: true,
      backup_restore: true,
      progress_tracking: true,
      analysis_history: true,
    },
  },
};

