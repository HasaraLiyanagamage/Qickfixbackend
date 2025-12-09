const axios = require('axios');

const BASE_URL = 'https://quickfix-backend-6ztz.onrender.com';

async function testProximity() {
  console.log('🧪 Testing Proximity Matching API\n');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const testCases = [
    {
      name: 'Colombo 3 (Galle Road)',
      lat: 6.9271,
      lng: 79.8612,
      skill: 'cleaning'
    },
    {
      name: 'Kandy',
      lat: 7.2906,
      lng: 80.6337,
      skill: 'cleaning'
    },
    {
      name: 'Gampaha',
      lat: 7.0917,
      lng: 79.9999,
      skill: 'cleaning'
    }
  ];
  
  for (const test of testCases) {
    console.log(`\n📍 Testing: ${test.name}`);
    console.log(`   Coordinates: (${test.lat}, ${test.lng})`);
    console.log(`   Skill: ${test.skill}`);
    console.log('   ---');
    
    try {
      const url = `${BASE_URL}/api/technician/available?skill=${test.skill}&lat=${test.lat}&lng=${test.lng}&radiusKm=50`;
      console.log(`   API Call: ${url}`);
      
      const response = await axios.get(url);
      const technicians = response.data;
      
      console.log(`   ✓ Response: ${technicians.length} technicians found`);
      
      if (technicians.length > 0) {
        technicians.forEach((tech, index) => {
          const name = tech.user?.name || 'Unknown';
          const distance = tech.distance;
          const coords = tech.location?.coordinates;
          
          console.log(`\n   [${index + 1}] ${name}`);
          console.log(`       Distance: ${distance !== undefined ? distance.toFixed(2) + ' km' : 'NOT CALCULATED'}`);
          console.log(`       Location: ${coords ? `[${coords[0]}, ${coords[1]}]` : 'No location'}`);
          console.log(`       Skills: ${tech.skills?.join(', ') || 'None'}`);
        });
      } else {
        console.log('   ⚠️  No technicians found within 50km');
      }
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      if (error.response) {
        console.log(`   Status: ${error.response.status}`);
        console.log(`   Data: ${JSON.stringify(error.response.data)}`);
      }
    }
    
    console.log('\n' + '─'.repeat(60));
  }
  
  console.log('\n✅ Testing complete!\n');
}

testProximity().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
