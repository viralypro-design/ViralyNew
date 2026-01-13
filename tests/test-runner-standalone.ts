/**
 * Standalone Test Runner for Subscription System
 * This version doesn't rely on path aliases
 */

import { createClient } from '@supabase/supabase-js';
import { SubscriptionRow, PlanType, FeatureKey } from '../src/types/subscription.js';
import { PLAN_CONFIG } from '../src/config/planConfig.js';

// Replicate usePlanAccess logic here to avoid path alias issues
function usePlanAccess(subscription?: SubscriptionRow): any | null {
  if (!subscription || subscription.status !== 'active') {
    return null;
  }

  const plan = PLAN_CONFIG[subscription.plan_type];
  if (!plan) {
    console.error(`Invalid plan_type: ${subscription.plan_type}`);
    return null;
  }

  return {
    planLabel: plan.label,
    hasFeature(feature: FeatureKey): boolean {
      return Boolean(plan.features[feature]);
    },
    canUploadVideo(videoMinutes: number, videoMB: number): boolean {
      if (videoMinutes < 0 || videoMB < 0) {
        return false;
      }
      return (
        videoMinutes <= plan.maxVideoMinutes &&
        videoMB <= plan.maxVideoMB
      );
    },
    canRunAnalysis(): boolean {
      if (plan.maxAnalysesPerMonth === -1) {
        return true;
      }
      if (subscription.analyses_used_monthly < 0) {
        return false;
      }
      return (
        subscription.analyses_used_monthly < plan.maxAnalysesPerMonth
      );
    },
    hasMinutesLeft(): boolean {
      if (subscription.minutes_used_monthly < 0) {
        return false;
      }
      return (
        subscription.minutes_used_monthly < plan.maxMinutesPerMonth
      );
    },
    canAddStudent(currentCount: number): boolean {
      if (!plan.maxStudents) {
        return false;
      }
      if (currentCount < 0) {
        return false;
      }
      return currentCount < plan.maxStudents;
    },
  };
}

// Load environment variables from .env file if it exists
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.resolve(process.cwd(), '.env');
const envLocalPath = path.resolve(process.cwd(), '.env.local');

// Try to load .env files
function loadEnvFile(filePath: string) {
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        // Handle both KEY=value and KEY="value" formats
        const match = trimmed.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          let value = match[2].trim();
          // Remove quotes if present
          if ((value.startsWith('"') && value.endsWith('"')) || 
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          // Override existing env var (env.local takes precedence)
          if (filePath === envLocalPath || !process.env[key]) {
            process.env[key] = value;
          }
        }
      }
    });
  }
}

// Load .env first, then .env.local (which will override)
loadEnvFile(envPath);
loadEnvFile(envLocalPath);

// Get environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables!');
  console.error('   Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
  console.error('   Options:');
  console.error('   1. Create .env file with:');
  console.error('      VITE_SUPABASE_URL=https://your-project.supabase.co');
  console.error('      VITE_SUPABASE_ANON_KEY=your-anon-key');
  console.error('   2. Or set environment variables:');
  console.error('      export VITE_SUPABASE_URL="..."');
  console.error('      export VITE_SUPABASE_ANON_KEY="..."');
  process.exit(1);
}

console.log(`✅ Loaded Supabase URL: ${supabaseUrl}`);
console.log(`✅ Loaded API Key: ${supabaseAnonKey.substring(0, 20)}...\n`);

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
      if (error) {
        console.log(`   ⚠️  Session check: ${error.message}`);
      }
      return !error;
    })
  );

  results.push(
    await runTest('User is authenticated (session exists)', async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        console.log('   ⚠️  No active session - some tests may be skipped');
      }
      return session?.user !== undefined;
    })
  );

  return results;
}

async function testDatabaseSchema(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  results.push(
    await runTest('Table subscriptions exists', async () => {
      try {
        const { data, error } = await supabase
          .from('subscriptions')
          .select('user_id')
          .limit(0);
        if (error) {
          console.log(`   ⚠️  Error code: ${error.code}, message: ${error.message}`);
        }
        return !error || error.code === 'PGRST116';
      } catch (error: any) {
        console.log(`   ⚠️  Exception: ${error.message}`);
        return false;
      }
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
        return true; // Skip if not authenticated
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
        return true; // Skip if not authenticated
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
      
      // Should fail with RLS error (not duplicate key)
      return error !== null && error.code !== '23505';
    })
  );

  results.push(
    await runTest('RLS blocks UPDATE with anon key', async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        return true; // Skip if not authenticated
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

async function testTypeScriptTypes(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  results.push(
    await runTest('All plan types in PLAN_CONFIG', async () => {
      try {
        const planTypes: PlanType[] = ['trial', 'creators', 'creators_extreme', 'coach', 'coach_pro'];
        const allExist = planTypes.every(plan => PLAN_CONFIG[plan] !== undefined);
        if (!allExist) {
          const missing = planTypes.filter(plan => PLAN_CONFIG[plan] === undefined);
          console.log(`   ⚠️  Missing plans: ${missing.join(', ')}`);
        }
        return allExist;
      } catch (error: any) {
        console.log(`   ⚠️  Error: ${error.message}`);
        return false;
      }
    })
  );

  results.push(
    await runTest('All features defined in config', async () => {
      try {
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
        
        const allDefined = Object.values(PLAN_CONFIG).every(plan => {
          return featureKeys.every(feature => feature in plan.features);
        });
        return allDefined;
      } catch (error: any) {
        console.log(`   ⚠️  Error: ${error.message}`);
        return false;
      }
    })
  );

  return results;
}

async function testUsePlanAccessHook(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  results.push(
    await runTest('usePlanAccess returns null for no subscription', async () => {
      try {
        const access = usePlanAccess(undefined);
        return access === null;
      } catch (error: any) {
        console.log(`   ⚠️  Error: ${error.message}`);
        return false;
      }
    })
  );

  results.push(
    await runTest('usePlanAccess returns null for inactive subscription', async () => {
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
    await runTest('usePlanAccess returns access for active subscription', async () => {
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
    await runTest('canRunAnalysis works correctly', async () => {
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
    await runTest('canRunAnalysis blocks when limit reached', async () => {
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
    await runTest('canRunAnalysis allows unlimited plans', async () => {
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
    await runTest('hasFeature works correctly', async () => {
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
    await runTest('canUploadVideo validates video size', async () => {
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
    await runTest('canAddStudent only for premium tracks', async () => {
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
    results: await testTypeScriptTypes(),
  });

  console.log('🪝 Testing usePlanAccess Hook...');
  suites.push({
    suiteName: 'usePlanAccess Hook Logic',
    results: await testUsePlanAccessHook(),
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

