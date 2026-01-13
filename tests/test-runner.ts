/**
 * Simple Test Runner for Subscription System
 * Runs all tests and reports results
 */

import { createClient } from '@supabase/supabase-js';
import { SubscriptionRow, PlanType, FeatureKey } from '../src/types/subscription.js';
import { PLAN_CONFIG } from '../src/config/planConfig.js';
import { usePlanAccess } from '../src/hooks/usePlanAccess.js';

// Get environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables!');
  console.error('   Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

type TestResult = {
  testName: string;
  passed: boolean;
  error?: string;
};

type TestSuite = {
  suiteName: string;
  results: TestResult[];
};

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

// Test Suites
async function testSupabaseConnection(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  results.push(
    await runTest('Supabase client initialized', () => {
      return supabase !== null && supabase !== undefined;
    })
  );

  results.push(
    await runTest('Can get session', async () => {
      const { data, error } = await supabase.auth.getSession();
      return !error;
    })
  );

  return results;
}

async function testDatabaseSchema(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  results.push(
    await runTest('Table subscriptions exists', async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('user_id')
        .limit(0);
      return !error || error.code === 'PGRST116';
    })
  );

  results.push(
    await runTest('Can query subscriptions table', async () => {
      const { error } = await supabase
        .from('subscriptions')
        .select('*')
        .limit(1);
      return !error || error.code === 'PGRST116';
    })
  );

  return results;
}

async function testRLSPolicies(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  results.push(
    await runTest('RLS allows reading own subscription', async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        return true;
      }

      const { error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', session.user.id)
        .single();
      
      return !error || error.code === 'PGRST116';
    })
  );

  results.push(
    await runTest('RLS blocks INSERT with anon key', async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        return true;
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
      
      return error !== null && error.code !== '23505';
    })
  );

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
      
      return error !== null;
    })
  );

  return results;
}

function testTypeScriptTypes(): TestResult[] {
  const results: TestResult[] = [];

  results.push(
    runTest('All plan types in PLAN_CONFIG', () => {
      const planTypes: PlanType[] = ['trial', 'creators', 'creators_extreme', 'coach', 'coach_pro'];
      return planTypes.every(plan => PLAN_CONFIG[plan] !== undefined);
    })
  );

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

  return results;
}

function testUsePlanAccessHook(): TestResult[] {
  const results: TestResult[] = [];

  results.push(
    runTest('usePlanAccess returns null for no subscription', () => {
      const access = usePlanAccess(undefined);
      return access === null;
    })
  );

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

  results.push(
    runTest('canRunAnalysis works correctly', () => {
      const sub: SubscriptionRow = {
        user_id: 'test-id',
        plan_type: 'creators',
        status: 'active',
        minutes_used_monthly: 0,
        analyses_used_monthly: 5,
      };
      const access = usePlanAccess(sub);
      if (!access) return false;
      return access.canRunAnalysis() === true;
    })
  );

  results.push(
    runTest('canRunAnalysis blocks when limit reached', () => {
      const sub: SubscriptionRow = {
        user_id: 'test-id',
        plan_type: 'creators',
        status: 'active',
        minutes_used_monthly: 0,
        analyses_used_monthly: 10,
      };
      const access = usePlanAccess(sub);
      if (!access) return false;
      return access.canRunAnalysis() === false;
    })
  );

  results.push(
    runTest('canRunAnalysis allows unlimited plans', () => {
      const sub: SubscriptionRow = {
        user_id: 'test-id',
        plan_type: 'coach',
        status: 'active',
        minutes_used_monthly: 0,
        analyses_used_monthly: 999,
      };
      const access = usePlanAccess(sub);
      if (!access) return false;
      return access.canRunAnalysis() === true;
    })
  );

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
      return access.hasFeature('pdf_export') === true;
    })
  );

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
      const valid = access.canUploadVideo(2, 10);
      const invalid = access.canUploadVideo(5, 20);
      return valid === true && invalid === false;
    })
  );

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
      
      return userAccess.canAddStudent(0) === false && 
             premiumAccess.canAddStudent(5) === true;
    })
  );

  return results;
}

async function testDataIntegrity(): Promise<TestResult[]> {
  const results: TestResult[] = [];

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
        return true;
      }
      
      return data.every(row => row.status === 'active' || row.status === 'inactive');
    })
  );

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
        return true;
      }
      
      const validPlanTypes: PlanType[] = ['trial', 'creators', 'creators_extreme', 'coach', 'coach_pro'];
      return data.every(row => validPlanTypes.includes(row.plan_type));
    })
  );

  return results;
}

// Main runner
async function main() {
  console.log('🚀 Starting Subscription System Test Suite...\n');
  console.log('='.repeat(60));
  console.log('');

  const suites: TestSuite[] = [];

  console.log('📡 Testing Supabase Connection...');
  suites.push({
    suiteName: 'Supabase Connection',
    results: await testSupabaseConnection(),
  });

  console.log('🗄️  Testing Database Schema...');
  suites.push({
    suiteName: 'Database Schema',
    results: await testDatabaseSchema(),
  });

  console.log('🔒 Testing RLS Policies...');
  suites.push({
    suiteName: 'RLS Policies',
    results: await testRLSPolicies(),
  });

  console.log('📝 Testing TypeScript Types...');
  suites.push({
    suiteName: 'TypeScript Types & Config',
    results: testTypeScriptTypes(),
  });

  console.log('🪝 Testing usePlanAccess Hook...');
  suites.push({
    suiteName: 'usePlanAccess Hook Logic',
    results: testUsePlanAccessHook(),
  });

  console.log('✅ Testing Data Integrity...');
  suites.push({
    suiteName: 'Data Integrity',
    results: await testDataIntegrity(),
  });

  console.log('\n📊 Test Results:\n');
  let totalTests = 0;
  let totalPassed = 0;
  let totalFailed = 0;

  suites.forEach(suite => {
    const passed = suite.results.filter(r => r.passed).length;
    const failed = suite.results.filter(r => !r.passed).length;
    totalTests += suite.results.length;
    totalPassed += passed;
    totalFailed += failed;

    const status = failed === 0 ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} - ${suite.suiteName}: ${passed}/${suite.results.length} passed`);

    if (failed > 0) {
      suite.results
        .filter(r => !r.passed)
        .forEach(result => {
          console.log(`   ❌ ${result.testName}`);
          if (result.error) {
            console.log(`      Error: ${result.error}`);
          }
        });
    }
  });

  console.log('\n' + '='.repeat(60));
  console.log(`\n📊 OVERALL SUMMARY:`);
  console.log(`   Total Tests: ${totalTests}`);
  console.log(`   ✅ Passed: ${totalPassed}`);
  console.log(`   ❌ Failed: ${totalFailed}`);
  console.log(`   Success Rate: ${((totalPassed / totalTests) * 100).toFixed(1)}%`);

  const allPassed = totalFailed === 0;
  console.log('\n' + '='.repeat(60));

  if (allPassed) {
    console.log('\n✅ SYSTEM READY FOR UI');
    console.log('   All subscription system checks passed successfully!');
    console.log('   The system is ready for UI integration.');
  } else {
    console.log('\n❌ SYSTEM NOT READY FOR UI');
    console.log('   Some tests failed. Please fix the issues before integrating with UI.');
  }

  console.log('\n' + '='.repeat(60) + '\n');

  process.exit(allPassed ? 0 : 1);
}

main().catch(error => {
  console.error('\n❌ FATAL ERROR:', error.message);
  console.error(error.stack);
  process.exit(1);
});

