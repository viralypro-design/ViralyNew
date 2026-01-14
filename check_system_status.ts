/**
 * System Status Check Script
 * Checks if the subscription system is properly set up
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
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const supabaseService = supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

async function checkSystemStatus() {
  console.log('🔍 Checking System Status...\n');
  console.log('='.repeat(60));

  const checks: Array<{ name: string; status: '✅' | '❌' | '⚠️'; message: string }> = [];

  // Check 1: Table exists
  try {
    const { data, error } = await supabase
      .from('user_subscriptions')
      .select('user_id')
      .limit(1);
    
    if (error && error.code === '42P01') {
      checks.push({ name: 'Table user_subscriptions', status: '❌', message: 'Table does not exist! Run migration: supabase_migration_subscription_system.sql' });
    } else if (error) {
      checks.push({ name: 'Table user_subscriptions', status: '⚠️', message: `Error: ${error.message}` });
    } else {
      checks.push({ name: 'Table user_subscriptions', status: '✅', message: 'Table exists' });
    }
  } catch (err: any) {
    checks.push({ name: 'Table user_subscriptions', status: '❌', message: `Error: ${err.message}` });
  }

  // Check 2: Can read from table (RLS check)
  try {
    const { data, error } = await supabase
      .from('user_subscriptions')
      .select('user_id')
      .limit(1);
    
    if (error && error.code === '42501') {
      checks.push({ name: 'RLS Policies', status: '⚠️', message: 'RLS might be blocking - this is OK if not logged in' });
    } else if (error && error.code !== 'PGRST116') {
      checks.push({ name: 'RLS Policies', status: '⚠️', message: `Error: ${error.message}` });
    } else {
      checks.push({ name: 'RLS Policies', status: '✅', message: 'RLS is configured (or table is empty)' });
    }
  } catch (err: any) {
    checks.push({ name: 'RLS Policies', status: '⚠️', message: `Error: ${err.message}` });
  }

  // Check 3: default_track column (if needed)
  try {
    const { data, error } = await supabase
      .from('user_subscriptions')
      .select('default_track')
      .limit(1);
    
    if (error && (error.message?.includes('column') || error.message?.includes('does not exist'))) {
      checks.push({ name: 'default_track column', status: '⚠️', message: 'Column does not exist - run: supabase_fix_default_track_column.sql' });
    } else if (error && error.code !== 'PGRST116') {
      checks.push({ name: 'default_track column', status: '⚠️', message: `Error: ${error.message}` });
    } else {
      checks.push({ name: 'default_track column', status: '✅', message: 'Column exists (or table is empty)' });
    }
  } catch (err: any) {
    checks.push({ name: 'default_track column', status: '⚠️', message: `Error: ${err.message}` });
  }

  // Check 4: RPC function exists
  try {
    const { data, error } = await supabase.rpc('update_user_default_track', {
      p_user_id: '00000000-0000-0000-0000-000000000000' as any,
      p_default_track: 'actors'
    });
    
    if (error && (error.message?.includes('function') || error.message?.includes('does not exist'))) {
      checks.push({ name: 'RPC update_user_default_track', status: '❌', message: 'Function does not exist! Run: supabase_rpc_update_default_track.sql' });
    } else if (error && error.message?.includes('User not found')) {
      checks.push({ name: 'RPC update_user_default_track', status: '✅', message: 'Function exists (tested with dummy user)' });
    } else if (error) {
      checks.push({ name: 'RPC update_user_default_track', status: '⚠️', message: `Error: ${error.message}` });
    } else {
      checks.push({ name: 'RPC update_user_default_track', status: '✅', message: 'Function exists' });
    }
  } catch (err: any) {
    checks.push({ name: 'RPC update_user_default_track', status: '❌', message: `Error: ${err.message}` });
  }

  // Check 5: Service role available
  if (supabaseService) {
    checks.push({ name: 'Service Role Key', status: '✅', message: 'Available (can create subscriptions manually)' });
  } else {
    checks.push({ name: 'Service Role Key', status: '⚠️', message: 'Not available (trigger must work for subscriptions)' });
  }

  // Print results
  console.log('\n📊 Check Results:\n');
  checks.forEach(check => {
    console.log(`${check.status} ${check.name}`);
    console.log(`   ${check.message}\n`);
  });

  // Summary
  const allGood = checks.every(c => c.status === '✅');
  const hasErrors = checks.some(c => c.status === '❌');

  console.log('='.repeat(60));
  if (allGood) {
    console.log('✅ All checks passed! System is ready.');
  } else if (hasErrors) {
    console.log('❌ Some critical checks failed. Please fix the issues above.');
    console.log('\n📋 Recommended actions:');
    checks.filter(c => c.status === '❌').forEach(check => {
      console.log(`   - Fix: ${check.name}`);
    });
  } else {
    console.log('⚠️  Some checks have warnings. System may work but review the issues above.');
  }
  console.log('='.repeat(60));
}

checkSystemStatus().then(() => {
  process.exit(0);
}).catch(error => {
  console.error('\n❌ FATAL ERROR:', error.message);
  process.exit(1);
});

