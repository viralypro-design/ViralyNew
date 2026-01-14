/**
 * Node.js Test Runner for Subscription System Checks
 * This wrapper handles Vite-specific imports for Node.js execution
 */

// Mock Vite's import.meta.env for Node.js
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// Mock import.meta.env for supabaseClient
const mockImportMeta = {
  env: {
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || '',
    VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || '',
  }
};

// Create Supabase client directly
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables!');
  console.error('   Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Import test functions and run them
async function runTests() {
  // Import the test file dynamically
  const testModule = await import('./subscription-system-check.js');
  
  // We need to manually run the tests since we can't use the supabaseClient import
  // Let's create a modified version that uses our supabase client
  
  console.log('🧪 Starting Subscription System Checks...\n');
  
  // We'll need to modify the test file to accept supabase as parameter
  // For now, let's try to run it and see what happens
  
  try {
    const suites = await testModule.runSubscriptionSystemChecks();
    
    console.log('\n' + '='.repeat(60));
    console.log('\n📋 FINAL REPORT:\n');
    
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
  } catch (error: any) {
    console.error('\n❌ FATAL ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runTests();


