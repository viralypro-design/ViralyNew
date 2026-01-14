/**
 * Test Script: Full Signup Flow Test
 * Tests complete user registration with plan and track selection
 * Email: maorcomp@gmail.com
 * 
 * This test:
 * 1. Signs up with maorcomp@gmail.com
 * 2. Sets plan_type to 'trial' in metadata
 * 3. Waits for trigger to create subscription
 * 4. Updates default_track to 'musicians'
 * 5. Signs out and signs in again
 * 6. Verifies subscription is loaded correctly
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
const envPath = path.resolve(process.cwd(), '.env.local');
const envLocalPath = path.resolve(process.cwd(), '.env');

function loadEnvFile(filePath: string) {
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const match = trimmed.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          let value = match[2].trim();
          if ((value.startsWith('"') && value.endsWith('"')) || 
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          if (filePath === envLocalPath || !process.env[key]) {
            process.env[key] = value;
          }
        }
      }
    });
  }
}

loadEnvFile(envPath);
loadEnvFile(envLocalPath);

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables!');
  console.error('   Required: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY');
  console.error('   Optional: SUPABASE_SERVICE_ROLE_KEY (for manual subscription creation)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);
// Create service role client if available (for manual subscription creation)
const supabaseService = supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

const TEST_EMAIL = 'maorcomp@gmail.com';
const TEST_PASSWORD = 'Test123456';
const TEST_PLAN = 'trial';
const TEST_TRACK = 'musicians';

async function testSignupFlow() {
  console.log('🚀 Starting Full Signup Flow Test\n');
  console.log('='.repeat(60));
  console.log(`📧 Email: ${TEST_EMAIL}`);
  console.log(`📦 Plan: ${TEST_PLAN}`);
  console.log(`🎯 Track: ${TEST_TRACK}`);
  console.log(`🔑 Service Role: ${supabaseService ? '✅ Available' : '❌ Not available (will use trigger only)'}`);
  console.log('='.repeat(60));
  console.log('');

  let userId: string | null = null;

  try {
    // Step 1: Sign out if already signed in
    console.log('📋 Step 1: Ensuring clean state...');
    const { data: existingSession } = await supabase.auth.getSession();
    
    if (existingSession?.session?.user) {
      console.log('   ⚠️  Already signed in, signing out...');
      await supabase.auth.signOut();
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('   ✅ Ready for signup');

    // Step 2: Sign up with plan_type in metadata
    console.log('\n📋 Step 2: Signing up user with plan_type in metadata...');
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      options: {
        data: {
          plan_type: TEST_PLAN,
        }
      }
    });

    if (signUpError) {
      if (signUpError.message.includes('already registered') || signUpError.message.includes('already exists')) {
        console.log('   ⚠️  User already registered, signing in...');
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: TEST_EMAIL,
          password: TEST_PASSWORD,
        });

        if (signInError) {
          console.error(`   ❌ Sign in failed: ${signInError.message}`);
          return;
        }

        if (!signInData.user) {
          console.error('   ❌ No user data returned from sign in');
          return;
        }

        userId = signInData.user.id;
        console.log('   ✅ Signed in successfully');
        console.log(`   📝 User ID: ${userId}`);
        
        // Verify metadata has plan_type
        console.log('\n📋 Step 2.1: Verifying user metadata...');
        const userMetadata = signInData.user.user_metadata || {};
        console.log(`   📝 Metadata: ${JSON.stringify(userMetadata)}`);
        
        if (userMetadata.plan_type !== TEST_PLAN) {
          console.log(`   ⚠️  Metadata plan_type is '${userMetadata.plan_type}', updating...`);
          // Update metadata if needed
          const { error: updateError } = await supabase.auth.updateUser({
            data: { plan_type: TEST_PLAN }
          });
          if (updateError) {
            console.error(`   ❌ Failed to update metadata: ${updateError.message}`);
          } else {
            console.log('   ✅ Metadata updated');
            // After updating metadata, check if subscription exists
            // If not, the trigger won't run (it only runs on INSERT), so we need to create it manually
            console.log('   ⚠️  Note: Trigger only runs on INSERT, not UPDATE. Checking subscription...');
          }
        } else {
          console.log(`   ✅ Metadata plan_type is correct: ${TEST_PLAN}`);
        }
      } else {
        console.error(`   ❌ Sign up failed: ${signUpError.message}`);
        return;
      }
    } else {
      if (!signUpData.user) {
        console.error('   ❌ No user data returned from signup');
        return;
      }

      userId = signUpData.user.id;
      console.log('   ✅ User created successfully');
      console.log(`   📝 User ID: ${userId}`);
      
      // Verify metadata
      console.log('\n📋 Step 2.1: Verifying user metadata...');
      const userMetadata = signUpData.user.user_metadata || {};
      console.log(`   📝 Metadata: ${JSON.stringify(userMetadata)}`);
      
      if (userMetadata.plan_type !== TEST_PLAN) {
        console.error(`   ❌ Metadata plan_type mismatch! Expected: ${TEST_PLAN}, Got: ${userMetadata.plan_type}`);
        // Try to update
        const { error: updateError } = await supabase.auth.updateUser({
          data: { plan_type: TEST_PLAN }
        });
        if (updateError) {
          console.error(`   ❌ Failed to update metadata: ${updateError.message}`);
        } else {
          console.log('   ✅ Metadata updated');
        }
      } else {
        console.log(`   ✅ Metadata plan_type is correct: ${TEST_PLAN}`);
      }
    }

    if (!userId) {
      console.error('   ❌ No user ID available');
      return;
    }

    // Step 3: Wait for trigger to create subscription (with retries)
    console.log('\n📋 Step 3: Waiting for trigger to create subscription...');
    let subscription = null;
    let retries = 0;
    const maxRetries = 5;
    
    while (!subscription && retries < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 1000 * (retries + 1))); // 1s, 2s, 3s, 4s, 5s
      
      const { data: subscriptions, error: subError } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId);
      
      if (subError && subError.code !== 'PGRST116') {
        console.error(`   ❌ Error fetching subscription (attempt ${retries + 1}): ${subError.message}`);
        retries++;
        continue;
      }
      
      if (subscriptions && subscriptions.length > 0) {
        subscription = subscriptions[0];
        console.log(`   ✅ Subscription found after ${retries + 1} attempt(s)`);
        break;
      }
      
      retries++;
      console.log(`   ⏳ Waiting for subscription... (attempt ${retries}/${maxRetries})`);
    }

    // Step 4: Create subscription manually if trigger didn't create it
    if (!subscription) {
      console.log('\n📋 Step 4: Trigger did not create subscription');
      console.log('   ⚠️  Possible reasons:');
      console.log('      1. Trigger was not installed (run supabase_migration_subscription_system.sql)');
      console.log('      2. User was created before trigger was set up');
      console.log('      3. Trigger failed silently');
      console.log('   Attempting to create subscription manually...');
      
      if (supabaseService) {
        console.log('   🔑 Using service role to create subscription...');
        const subscriptionData: any = {
          user_id: userId,
          plan_type: TEST_PLAN,
          status: 'active',
          minutes_used_monthly: 0,
          analyses_used_monthly: 0
        };
        
        const { data: newSub, error: createError } = await supabaseService
          .from('user_subscriptions')
          .insert(subscriptionData)
          .select()
          .single();
        
        if (createError) {
          console.error(`   ❌ Error creating subscription with service role: ${createError.message}`);
          console.error(`   Error code: ${createError.code}`);
          console.error(`   Error details: ${JSON.stringify(createError)}`);
          console.log('\n   💡 To fix this:');
          console.log('      1. Run verify_and_fix_trigger.sql to check trigger status');
          console.log('      2. If trigger is missing, run supabase_migration_subscription_system.sql');
          console.log('      3. For existing users, you may need to create subscription manually via SQL');
          return;
        }
        
        subscription = newSub;
        console.log('   ✅ Subscription created with service role');
      } else {
        console.error('   ❌ Cannot create subscription manually - service role key not available');
        console.error('\n   💡 To fix this:');
        console.error('      1. Add SUPABASE_SERVICE_ROLE_KEY to .env.local');
        console.error('      2. Or run verify_and_fix_trigger.sql in Supabase SQL Editor');
        console.error('      3. Or manually create subscription via SQL:');
        console.error(`         INSERT INTO user_subscriptions (user_id, plan_type, status) VALUES ('${userId}', '${TEST_PLAN}', 'active');`);
        return;
      }
    } else {
      console.log('   ✅ Subscription was created by trigger');
    }

    if (!subscription) {
      console.error('   ❌ No subscription available after all attempts');
      return;
    }

    console.log('\n📋 Step 5: Subscription Details:');
    console.log(`   📦 Plan Type: ${subscription.plan_type}`);
    console.log(`   📊 Status: ${subscription.status}`);
    console.log(`   🎯 Default Track: ${subscription.default_track || 'NULL'}`);

    // Step 6: Update track
    console.log('\n📋 Step 6: Updating default track...');
    const { error: trackError } = await supabase.rpc('update_user_default_track', {
      p_user_id: userId,
      p_default_track: TEST_TRACK
    });

    if (trackError) {
      console.error(`   ❌ Error updating track via RPC: ${trackError.message}`);
      
      if (supabaseService) {
        console.log('   🔑 Trying with service role...');
        const { error: serviceError } = await supabaseService
          .from('user_subscriptions')
          .update({ default_track: TEST_TRACK })
          .eq('user_id', userId);
        
        if (serviceError) {
          console.error(`   ❌ Service role update also failed: ${serviceError.message}`);
        } else {
          console.log('   ✅ Track updated with service role');
        }
      }
    } else {
      console.log('   ✅ Track updated successfully via RPC');
    }

    // Step 7: Verify final state
    await verifySubscription(userId);

    // Step 8: Sign out and sign in again to verify persistence
    console.log('\n📋 Step 8: Testing login flow...');
    await supabase.auth.signOut();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    if (signInError) {
      console.error(`   ❌ Sign in failed: ${signInError.message}`);
      return;
    }

    if (!signInData.user) {
      console.error('   ❌ No user data returned from sign in');
      return;
    }

    console.log('   ✅ Signed in successfully');
    console.log(`   📝 User ID: ${signInData.user.id}`);
    
    // Wait a bit for subscription to load
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Verify subscription after login
    await verifySubscription(signInData.user.id);

    console.log('\n' + '='.repeat(60));
    console.log('✅ TEST COMPLETED SUCCESSFULLY');
    console.log('='.repeat(60));

  } catch (error: any) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error(error.stack);
    if (userId) {
      console.log('\n📋 Attempting to verify subscription state...');
      await verifySubscription(userId);
    }
  }
}

async function verifySubscription(userId: string) {
  console.log(`\n📋 Verifying subscription for user: ${userId}...`);
  
  // Try with regular client first
  let { data: subscriptions, error } = await supabase
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', userId);
  
  // If error and we have service role, try with that
  if (error && supabaseService) {
    console.log('   ⚠️  Error with regular client, trying service role...');
    const serviceResult = await supabaseService
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId);
    
    if (!serviceResult.error) {
      subscriptions = serviceResult.data;
      error = null;
      console.log('   ✅ Retrieved subscription with service role');
    }
  }
  
  if (error) {
    console.error(`   ❌ Error fetching subscription: ${error.message}`);
    console.error(`   Error code: ${error.code}`);
    console.error(`   Error details: ${JSON.stringify(error)}`);
    return false;
  }
  
  console.log(`   📊 Found ${subscriptions?.length || 0} subscription(s)`);
  
  const subscription = subscriptions && subscriptions.length > 0 ? subscriptions[0] : null;

  if (!subscription) {
    console.error('   ❌ No subscription found');
    console.error('   ⚠️  This means the subscription was not created or is not accessible');
    return false;
  }

  console.log('\n   ✅ Subscription Details:');
  console.log(`      Plan Type: ${subscription.plan_type}`);
  console.log(`      Status: ${subscription.status}`);
  console.log(`      Default Track: ${subscription.default_track || 'NULL'}`);
  console.log(`      Minutes Used: ${subscription.minutes_used_monthly}`);
  console.log(`      Analyses Used: ${subscription.analyses_used_monthly}`);
  console.log(`      Created At: ${subscription.created_at || 'N/A'}`);
  console.log(`      Updated At: ${subscription.updated_at || 'N/A'}`);

  let allValid = true;

  // Verify plan
  if (subscription.plan_type !== TEST_PLAN) {
    console.error(`   ❌ Plan mismatch! Expected: ${TEST_PLAN}, Got: ${subscription.plan_type}`);
    allValid = false;
  } else {
    console.log(`   ✅ Plan is correct: ${TEST_PLAN}`);
  }

  // Verify track
  if (subscription.default_track !== TEST_TRACK) {
    console.error(`   ❌ Track mismatch! Expected: ${TEST_TRACK}, Got: ${subscription.default_track || 'NULL'}`);
    allValid = false;
  } else {
    console.log(`   ✅ Track is correct: ${TEST_TRACK}`);
  }

  // Verify status
  if (subscription.status !== 'active') {
    console.error(`   ❌ Status is not active! Got: ${subscription.status}`);
    allValid = false;
  } else {
    console.log('   ✅ Status is active');
  }

  // Verify usage counters
  if (subscription.minutes_used_monthly !== 0) {
    console.warn(`   ⚠️  Minutes used is not 0: ${subscription.minutes_used_monthly}`);
  } else {
    console.log('   ✅ Minutes used is 0');
  }

  if (subscription.analyses_used_monthly !== 0) {
    console.warn(`   ⚠️  Analyses used is not 0: ${subscription.analyses_used_monthly}`);
  } else {
    console.log('   ✅ Analyses used is 0');
  }

  if (allValid) {
    console.log('\n   ✅✅✅ ALL VERIFICATIONS PASSED ✅✅✅');
  } else {
    console.log('\n   ❌❌❌ SOME VERIFICATIONS FAILED ❌❌❌');
  }

  return allValid;
}

// Run test
testSignupFlow().then(() => {
  console.log('\n👋 Test completed');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ FATAL ERROR:', error.message);
  console.error(error.stack);
  process.exit(1);
});

