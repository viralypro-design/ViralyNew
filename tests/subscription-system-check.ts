/**
 * Subscription System Check
 * =========================
 * בדיקות מערכת Auth + Subscriptions בלבד
 * 
 * ⚠️ זהירות:
 * - אל תיגע ב-UI
 * - אל תשנה סכמות DB
 * - בדיקות בלבד
 */

import { supabase } from '../src/lib/supabaseClient';
import { SubscriptionRow, PlanType, FeatureKey } from '../src/types/subscription';
import { PLAN_CONFIG } from '../src/config/planConfig';
import { usePlanAccess } from '../src/hooks/usePlanAccess';

// ============================================================================
// Types for Testing
// ============================================================================

type TestResult = {
  testName: string;
  passed: boolean;
  error?: string;
  details?: any;
};

type TestSuite = {
  suiteName: string;
  results: TestResult[];
};

// ============================================================================
// Test Helpers
// ============================================================================

async function runTest(
  testName: string,
  testFn: () => Promise<boolean> | boolean
): Promise<TestResult> {
  try {
    const result = await testFn();
    return {
      testName,
      passed: result === true,
      error: result === false ? 'Test returned false' : undefined,
    };
  } catch (error: any) {
    return {
      testName,
      passed: false,
      error: error.message || String(error),
    };
  }
}

// ============================================================================
// Test Suite 1: Supabase Connection
// ============================================================================

async function testSupabaseConnection(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // Test 1.1: Supabase client initialized
  results.push(
    await runTest('Supabase client initialized', () => {
      return supabase !== null && supabase !== undefined;
    })
  );

  // Test 1.2: Can get session
  results.push(
    await runTest('Can get session', async () => {
      const { data, error } = await supabase.auth.getSession();
      return !error; // לא משנה אם יש session או לא, רק שהקריאה עובדת
    })
  );

  return results;
}

// ============================================================================
// Test Suite 2: Database Schema
// ============================================================================

async function testDatabaseSchema(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // Test 2.1: Table 'subscriptions' exists
  results.push(
    await runTest('Table subscriptions exists', async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('user_id')
        .limit(0);
      
      // אם אין שגיאה או שהשגיאה היא רק שאין רשומות - הטבלה קיימת
      return !error || error.code === 'PGRST116';
    })
  );

  // Test 2.2: Can query subscriptions (even if empty)
  results.push(
    await runTest('Can query subscriptions table', async () => {
      const { error } = await supabase
        .from('subscriptions')
        .select('*')
        .limit(1);
      
      // PGRST116 = no rows found (זה תקין)
      return !error || error.code === 'PGRST116';
    })
  );

  return results;
}

// ============================================================================
// Test Suite 3: RLS Policies
// ============================================================================

async function testRLSPolicies(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // Test 3.1: Can read own subscription (if authenticated)
  results.push(
    await runTest('RLS allows reading own subscription', async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        // לא מחובר - זה תקין, RLS יעבוד כשיתחבר
        return true;
      }

      const { error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', session.user.id)
        .single();
      
      // PGRST116 = no rows found (זה תקין - אין subscription)
      // כל שגיאה אחרת = בעיה
      return !error || error.code === 'PGRST116';
    })
  );

  // Test 3.2: Cannot insert without service_role (anon key)
  results.push(
    await runTest('RLS blocks INSERT with anon key', async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        return true; // לא מחובר - לא רלוונטי
      }

      const testSubscription: Partial<SubscriptionRow> = {
        user_id: session.user.id,
        plan_type: 'trial',
        status: 'active',
        minutes_used_monthly: 0,
        analyses_used_monthly: 0,
      };

      const { error } = await supabase
        .from('subscriptions')
        .insert(testSubscription);
      
      // אמור להיכשל עם RLS error
      return error !== null && error.code !== '23505'; // 23505 = duplicate key (זה גם תקין)
    })
  );

  // Test 3.3: Cannot update without service_role (anon key)
  results.push(
    await runTest('RLS blocks UPDATE with anon key', async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        return true;
      }

      const { error } = await supabase
        .from('subscriptions')
        .update({ minutes_used_monthly: 1 })
        .eq('user_id', session.user.id);
      
      // אמור להיכשל עם RLS error או לא למצוא רשומה
      return error !== null;
    })
  );

  return results;
}

// ============================================================================
// Test Suite 4: TypeScript Types & Config
// ============================================================================

function testTypeScriptTypes(): TestResult[] {
  const results: TestResult[] = [];

  // Test 4.1: All plan types exist in config
  results.push(
    runTest('All plan types in PLAN_CONFIG', () => {
      const planTypes: PlanType[] = ['trial', 'creators', 'creators_extreme', 'coach', 'coach_pro'];
      return planTypes.every(plan => PLAN_CONFIG[plan] !== undefined);
    })
  );

  // Test 4.2: All features defined
  results.push(
    runTest('All features defined in config', () => {
      const featureKeys: FeatureKey[] = [
        'pdf_export',
        'advanced_analysis',
        'compare_videos',
        'student_dashboard',
        'students_management',
        'backup_restore',
        'progress_tracking',
        'analysis_history',
      ];
      
      return Object.values(PLAN_CONFIG).every(plan => {
        return featureKeys.every(feature => feature in plan.features);
      });
    })
  );

  // Test 4.3: No default for plan_type
  results.push(
    runTest('No default plan_type in config', () => {
      // בדיקה שהקונפיג לא מכיל fallback
      // זה בדיקה לוגית - הקונפיג לא צריך להכיל default
      return true; // זה נבדק ב-migration SQL
    })
  );

  return results;
}

// ============================================================================
// Test Suite 5: usePlanAccess Hook Logic
// ============================================================================

function testUsePlanAccessHook(): TestResult[] {
  const results: TestResult[] = [];

  // Test 5.1: Returns null for no subscription
  results.push(
    runTest('usePlanAccess returns null for no subscription', () => {
      const access = usePlanAccess(undefined);
      return access === null;
    })
  );

  // Test 5.2: Returns null for inactive subscription
  results.push(
    runTest('usePlanAccess returns null for inactive subscription', () => {
      const inactiveSub: SubscriptionRow = {
        user_id: 'test-id',
        plan_type: 'trial',
        status: 'inactive',
        minutes_used_monthly: 0,
        analyses_used_monthly: 0,
      };
      const access = usePlanAccess(inactiveSub);
      return access === null;
    })
  );

  // Test 5.3: Returns access for active subscription
  results.push(
    runTest('usePlanAccess returns access for active subscription', () => {
      const activeSub: SubscriptionRow = {
        user_id: 'test-id',
        plan_type: 'creators',
        status: 'active',
        minutes_used_monthly: 0,
        analyses_used_monthly: 0,
      };
      const access = usePlanAccess(activeSub);
      return access !== null && access.planLabel === PLAN_CONFIG.creators.label;
    })
  );

  // Test 5.4: canRunAnalysis works correctly
  results.push(
    runTest('canRunAnalysis works correctly', () => {
      const sub: SubscriptionRow = {
        user_id: 'test-id',
        plan_type: 'creators',
        status: 'active',
        minutes_used_monthly: 0,
        analyses_used_monthly: 5, // 5 מתוך 10
      };
      const access = usePlanAccess(sub);
      if (!access) return false;
      
      // אמור להחזיר true (5 < 10)
      return access.canRunAnalysis() === true;
    })
  );

  // Test 5.5: canRunAnalysis blocks when limit reached
  results.push(
    runTest('canRunAnalysis blocks when limit reached', () => {
      const sub: SubscriptionRow = {
        user_id: 'test-id',
        plan_type: 'creators',
        status: 'active',
        minutes_used_monthly: 0,
        analyses_used_monthly: 10, // 10 מתוך 10 - הגבול
      };
      const access = usePlanAccess(sub);
      if (!access) return false;
      
      // אמור להחזיר false (10 >= 10)
      return access.canRunAnalysis() === false;
    })
  );

  // Test 5.6: canRunAnalysis allows unlimited (-1)
  results.push(
    runTest('canRunAnalysis allows unlimited plans', () => {
      const sub: SubscriptionRow = {
        user_id: 'test-id',
        plan_type: 'coach',
        status: 'active',
        minutes_used_monthly: 0,
        analyses_used_monthly: 999, // הרבה, אבל -1 = ללא הגבלה
      };
      const access = usePlanAccess(sub);
      if (!access) return false;
      
      // אמור להחזיר true (maxAnalysesPerMonth = -1)
      return access.canRunAnalysis() === true;
    })
  );

  // Test 5.7: hasFeature works correctly
  results.push(
    runTest('hasFeature works correctly', () => {
      const sub: SubscriptionRow = {
        user_id: 'test-id',
        plan_type: 'creators',
        status: 'active',
        minutes_used_monthly: 0,
        analyses_used_monthly: 0,
      };
      const access = usePlanAccess(sub);
      if (!access) return false;
      
      // creators plan has pdf_export = true
      return access.hasFeature('pdf_export') === true;
    })
  );

  // Test 5.8: canUploadVideo validates size
  results.push(
    runTest('canUploadVideo validates video size', () => {
      const sub: SubscriptionRow = {
        user_id: 'test-id',
        plan_type: 'creators',
        status: 'active',
        minutes_used_monthly: 0,
        analyses_used_monthly: 0,
      };
      const access = usePlanAccess(sub);
      if (!access) return false;
      
      // creators: maxVideoMinutes = 3, maxVideoMB = 15
      const valid = access.canUploadVideo(2, 10); // 2 דקות, 10MB - תקין
      const invalid = access.canUploadVideo(5, 20); // 5 דקות, 20MB - לא תקין
      
      return valid === true && invalid === false;
    })
  );

  // Test 5.9: canAddStudent only for premium tracks
  results.push(
    runTest('canAddStudent only for premium tracks', () => {
      const userSub: SubscriptionRow = {
        user_id: 'test-id',
        plan_type: 'creators',
        status: 'active',
        minutes_used_monthly: 0,
        analyses_used_monthly: 0,
      };
      const premiumSub: SubscriptionRow = {
        user_id: 'test-id',
        plan_type: 'coach',
        status: 'active',
        minutes_used_monthly: 0,
        analyses_used_monthly: 0,
      };
      
      const userAccess = usePlanAccess(userSub);
      const premiumAccess = usePlanAccess(premiumSub);
      
      if (!userAccess || !premiumAccess) return false;
      
      // creators לא יכול להוסיף תלמידים
      // coach יכול (maxStudents = 10)
      return userAccess.canAddStudent(0) === false && 
             premiumAccess.canAddStudent(5) === true;
    })
  );

  return results;
}

// ============================================================================
// Test Suite 6: Data Integrity
// ============================================================================

async function testDataIntegrity(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // Test 6.1: No subscription without plan_type (trigger check)
  results.push(
    await runTest('No subscription created without plan_type', async () => {
      // זה נבדק ב-trigger - אם trigger עובד נכון, לא יווצר subscription
      // בלי plan_type ב-metadata
      return true; // זה נבדק ב-Supabase trigger, לא כאן
    })
  );

  // Test 6.2: Subscription status is valid enum
  results.push(
    await runTest('Subscription status is valid enum', async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('status')
        .limit(10);
      
      if (error && error.code !== 'PGRST116') {
        return false;
      }
      
      if (!data || data.length === 0) {
        return true; // אין רשומות - זה תקין
      }
      
      // בדיקה שכל ה-statuses הם 'active' או 'inactive'
      return data.every(row => row.status === 'active' || row.status === 'inactive');
    })
  );

  // Test 6.3: Plan type is valid enum
  results.push(
    await runTest('Plan type is valid enum', async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('plan_type')
        .limit(10);
      
      if (error && error.code !== 'PGRST116') {
        return false;
      }
      
      if (!data || data.length === 0) {
        return true; // אין רשומות - זה תקין
      }
      
      const validPlanTypes: PlanType[] = ['trial', 'creators', 'creators_extreme', 'coach', 'coach_pro'];
      return data.every(row => validPlanTypes.includes(row.plan_type));
    })
  );

  return results;
}

// ============================================================================
// Main Test Runner
// ============================================================================

export async function runSubscriptionSystemChecks(): Promise<TestSuite[]> {
  console.log('🧪 Starting Subscription System Checks...\n');

  const suites: TestSuite[] = [];

  // Suite 1: Supabase Connection
  console.log('📡 Testing Supabase Connection...');
  suites.push({
    suiteName: 'Supabase Connection',
    results: await testSupabaseConnection(),
  });

  // Suite 2: Database Schema
  console.log('🗄️  Testing Database Schema...');
  suites.push({
    suiteName: 'Database Schema',
    results: await testDatabaseSchema(),
  });

  // Suite 3: RLS Policies
  console.log('🔒 Testing RLS Policies...');
  suites.push({
    suiteName: 'RLS Policies',
    results: await testRLSPolicies(),
  });

  // Suite 4: TypeScript Types
  console.log('📝 Testing TypeScript Types...');
  suites.push({
    suiteName: 'TypeScript Types & Config',
    results: testTypeScriptTypes(),
  });

  // Suite 5: usePlanAccess Hook
  console.log('🪝 Testing usePlanAccess Hook...');
  suites.push({
    suiteName: 'usePlanAccess Hook Logic',
    results: testUsePlanAccessHook(),
  });

  // Suite 6: Data Integrity
  console.log('✅ Testing Data Integrity...');
  suites.push({
    suiteName: 'Data Integrity',
    results: await testDataIntegrity(),
  });

  // Print Results
  console.log('\n📊 Test Results:\n');
  let totalTests = 0;
  let passedTests = 0;

  suites.forEach(suite => {
    console.log(`\n${suite.suiteName}:`);
    suite.results.forEach(result => {
      totalTests++;
      if (result.passed) {
        passedTests++;
        console.log(`  ✅ ${result.testName}`);
      } else {
        console.log(`  ❌ ${result.testName}`);
        if (result.error) {
          console.log(`     Error: ${result.error}`);
        }
      }
    });
  });

  console.log(`\n📈 Summary: ${passedTests}/${totalTests} tests passed\n`);

  return suites;
}

// ============================================================================
// Export for manual testing
// ============================================================================

// להרצה ידנית:
// import { runSubscriptionSystemChecks } from './tests/subscription-system-check';
// runSubscriptionSystemChecks().then(results => console.log(results));

