/**
 * Test Runner for Subscription System Checks
 * Run this file to execute all subscription system tests
 */

import { runSubscriptionSystemChecks } from './subscription-system-check';

async function main() {
  console.log('🚀 Starting Subscription System Test Suite...\n');
  console.log('='.repeat(60));
  console.log('');
  
  try {
    const suites = await runSubscriptionSystemChecks();
    
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

main();


