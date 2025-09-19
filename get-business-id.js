// Simple script to get your business ID
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function getBusinessId() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  try {
    const { data, error } = await supabase
      .from('businesses')
      .select('id, name, owner_email')
      .limit(5);

    if (error) {
      console.error('❌ Error:', error.message);
      console.log('\n🔧 Make sure you:');
      console.log('1. Ran the SQL initialization script in Supabase');
      console.log('2. Have correct SUPABASE_URL and SUPABASE_SERVICE_KEY in .env');
      return;
    }

    if (data && data.length > 0) {
      console.log('✅ Found businesses in your database:');
      data.forEach((business, index) => {
        console.log(`\n${index + 1}. ${business.name}`);
        console.log(`   ID: ${business.id}`);
        console.log(`   Email: ${business.owner_email}`);
      });

      console.log('\n🎯 Use this Business ID for testing:');
      console.log(`BUSINESS_ID="${data[0].id}"`);

      return data[0].id;
    } else {
      console.log('❌ No businesses found. Please run the SQL initialization script.');
    }
  } catch (error) {
    console.error('❌ Connection error:', error.message);
    console.log('\n🔧 Check your .env file configuration');
  }
}

getBusinessId().catch(console.error);