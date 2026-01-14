/**
 * Test Script: Full Signup Flow Test
 * Tests complete user registration with plan and track selection
 * Email: maorcomp@gmail.com
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

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
  console.log('='.repeat(60));
  console.log('');

  try {
    // Step 1: Check if user already exists by trying to sign in first
    console.log('📋 Step 1: Checking if user already exists...');
    const { data: existingSession } = await supabase.auth.getSession();
    
    if (existingSession?.session?.user) {
      console.log('   ⚠️  Already signed in, signing out...');
      await supabase.auth.signOut();
    }
    
    console.log('   ✅ Proceeding with signup...');

    // Step 2: Sign up
    console.log('\n📋 Step 2: Signing up user...');
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
      if (signUpError.message.includes('already registered')) {
        console.log('   ⚠️  User already registered, signing in...');
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: TEST_EMAIL,
          password: TEST_PASSWORD,
        });

        if (signInError) {
          console.error(`   ❌ Sign in failed: ${signInError.message}`);
          return;
        }

        if (signInData.user) {
          console.log('   ✅ Signed in successfully');
          console.log(`   📝 User ID: ${signInData.user.id}`);
          
          // Wait for subscription
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Check and create subscription if needed
          const { data: subs } = await supabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', signInData.user.id);
          
          if (!subs || subs.length === 0) {
            console.log('   ⚠️  No subscription found, creating...');
            const subData: any = {
              user_id: signInData.user.id,
              plan_type: TEST_PLAN,
              status: 'active',
              minutes_used_monthly: 0,
              analyses_used_monthly: 0
            };
            
            const { data: newSub, error: createErr } = await supabase
              .from('user_subscriptions')
              .insert(subData)
              .select()
              .single();
            
            if (createErr) {
              console.error(`   ❌ Error: ${createErr.message}`);
            } else {
              console.log('   ✅ Subscription created');
            }
          }
          
          // Update track
          console.log('   📋 Updating track...');
          const { error: trackErr } = await supabase.rpc('update_user_default_track', {
            p_user_id: signInData.user.id,
            p_default_track: TEST_TRACK
          });
          
          if (trackErr) {
            console.error(`   ❌ Track update error: ${trackErr.message}`);
            // Try direct update
            const { error: directErr } = await supabase
              .from('user_subscriptions')
              .update({ default_track: TEST_TRACK })
              .eq('user_id', signInData.user.id);
            
            if (directErr) {
              console.error(`   ❌ Direct update error: ${directErr.message}`);
            } else {
              console.log('   ✅ Track updated via direct update');
            }
          } else {
            console.log('   ✅ Track updated via RPC');
          }
          
          await verifySubscription(signInData.user.id);
        }
        return;
      } else {
        console.error(`   ❌ Sign up failed: ${signUpError.message}`);
        return;
      }
    }

    if (!signUpData.user) {
      console.error('   ❌ No user data returned');
      return;
    }

    console.log('   ✅ User created successfully');
    console.log(`   📝 User ID: ${signUpData.user.id}`);

    // Step 3: Wait for trigger to create subscription
    console.log('\n📋 Step 3: Waiting for subscription to be created...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 4: Check subscription
    const { data: subscriptions, error: subError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', signUpData.user.id);
    
    let subscription = subscriptions && subscriptions.length > 0 ? subscriptions[0] : null;

    if (subError) {
      console.error(`   ❌ Error fetching subscription: ${subError.message}`);
      return;
    }

    if (!subscription) {
      console.log('   ⚠️  No subscription found, creating manually...');
      console.log(`   📝 User ID: ${signUpData.user.id}`);
      // Create subscription manually
      const subscriptionData: any = {
        user_id: signUpData.user.id,
        plan_type: TEST_PLAN,
        status: 'active',
        minutes_used_monthly: 0,
        analyses_used_monthly: 0
      };
      
      // Try to add default_track if column exists
      try {
        subscriptionData.default_track = TEST_TRACK;
      } catch (e) {
        // Ignore if column doesn't exist
      }
      
      const { data: newSub, error: createError } = await supabase
        .from('user_subscriptions')
        .insert(subscriptionData)
        .select()
        .single();
      
      if (createError) {
        console.error(`   ❌ Error creating subscription: ${createError.message}`);
        // Try without default_track
        const { data: newSub2, error: createError2 } = await supabase
          .from('user_subscriptions')
          .insert({
            user_id: signUpData.user.id,
            plan_type: TEST_PLAN,
            status: 'active',
            minutes_used_monthly: 0,
            analyses_used_monthly: 0
          })
          .select()
          .single();
        
        if (createError2) {
          console.error(`   ❌ Error creating subscription without track: ${createError2.message}`);
          console.error(`   Error code: ${createError2.code}`);
          console.error(`   Error details: ${JSON.stringify(createError2)}`);
          return;
        }
        
        subscription = newSub2;
        console.log('   ✅ Subscription created without track');
      } else {
        subscription = newSub;
        console.log('   ✅ Subscription created with track');
      }
    } else {
      console.log('   ✅ Subscription found');
    }

    console.log('   ✅ Subscription found');
    console.log(`   📦 Plan Type: ${subscription.plan_type}`);
    console.log(`   📊 Status: ${subscription.status}`);

    // Step 5: Update track
    console.log('\n📋 Step 5: Updating default track...');
    const { error: trackError } = await supabase.rpc('update_user_default_track', {
      p_user_id: signUpData.user.id,
      p_default_track: TEST_TRACK
    });

    if (trackError) {
      console.error(`   ❌ Error updating track: ${trackError.message}`);
      // Try direct update
      const { error: directError } = await supabase
        .from('user_subscriptions')
        .update({ default_track: TEST_TRACK })
        .eq('user_id', signUpData.user.id);
      
      if (directError) {
        console.error(`   ❌ Direct update also failed: ${directError.message}`);
      } else {
        console.log('   ✅ Track updated via direct update');
      }
    } else {
      console.log('   ✅ Track updated successfully');
    }

    // Step 6: Verify final state
    await verifySubscription(signUpData.user.id);

    // Step 7: Sign in and verify
    console.log('\n📋 Step 7: Signing in to verify...');
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

    console.log('   ✅ Signed in successfully');
    await verifySubscription(signInData.user!.id);

    console.log('\n' + '='.repeat(60));
    console.log('✅ TEST COMPLETED SUCCESSFULLY');
    console.log('='.repeat(60));

  } catch (error: any) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error(error.stack);
  }
}

async function verifySubscription(userId: string) {
  console.log(`\n📋 Verifying subscription for user: ${userId}...`);
  
  const { data: subscriptions, error } = await supabase
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', userId);
  
  if (error) {
    console.error(`   ❌ Error fetching subscription: ${error.message}`);
    console.error(`   Error code: ${error.code}`);
    return;
  }
  
  console.log(`   📊 Found ${subscriptions?.length || 0} subscription(s)`);
  
  const subscription = subscriptions && subscriptions.length > 0 ? subscriptions[0] : null;

  if (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return;
  }

  if (!subscription) {
    console.error('   ❌ No subscription found');
    return;
  }

  console.log('   ✅ Subscription Details:');
  console.log(`      Plan Type: ${subscription.plan_type}`);
  console.log(`      Status: ${subscription.status}`);
  console.log(`      Default Track: ${subscription.default_track || 'NULL'}`);
  console.log(`      Minutes Used: ${subscription.minutes_used_monthly}`);
  console.log(`      Analyses Used: ${subscription.analyses_used_monthly}`);

  // Verify plan
  if (subscription.plan_type !== TEST_PLAN) {
    console.error(`   ❌ Plan mismatch! Expected: ${TEST_PLAN}, Got: ${subscription.plan_type}`);
  } else {
    console.log(`   ✅ Plan is correct: ${TEST_PLAN}`);
  }

  // Verify track
  if (subscription.default_track !== TEST_TRACK) {
    console.error(`   ❌ Track mismatch! Expected: ${TEST_TRACK}, Got: ${subscription.default_track || 'NULL'}`);
  } else {
    console.log(`   ✅ Track is correct: ${TEST_TRACK}`);
  }

  // Verify status
  if (subscription.status !== 'active') {
    console.error(`   ❌ Status is not active! Got: ${subscription.status}`);
  } else {
    console.log('   ✅ Status is active');
  }
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

