/**
 * סוגי החבילות הזמינות במערכת
 * אין fallback - אם אין subscription פעיל, אין גישה
 */
export type PlanType =
  | 'trial'
  | 'creators'
  | 'creators_extreme'
  | 'coach'
  | 'coach_pro';

/**
 * מפתחות התכונות הזמינות במערכת
 */
export type FeatureKey =
  | 'pdf_export'
  | 'advanced_analysis'
  | 'compare_videos'
  | 'student_dashboard'
  | 'students_management'
  | 'backup_restore'
  | 'progress_tracking'
  | 'analysis_history';

/**
 * שורת מנוי מה-DB
 * כל הנתונים מגיעים מה-DB בלבד - אין localStorage או fallback
 */
export interface SubscriptionRow {
  user_id: string;
  plan_type: PlanType;
  status: 'active' | 'inactive';
  minutes_used_monthly: number;
  analyses_used_monthly: number;
}

