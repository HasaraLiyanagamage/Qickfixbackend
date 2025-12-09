require('dotenv').config();
const mongoose = require('mongoose');
const Technician = require('../models/Technician');
const User = require('../models/User');

const MONGO = process.env.MONGO_URI || 'mongodb+srv://qfix3184_db_user:D5dMh3sVcVljKgf0@quickfix.ad3tevk.mongodb.net/?appName=quickfix';

async function updateWajira() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO);
    console.log('✓ Connected\n');
    
    const user = await User.findOne({ email: 'wajira@gmail.com' });
    if (!user) {
      console.log('❌ Wajira user not found');
      process.exit(0);
    }
    
    console.log(`Found user: ${user.name} (${user.email})`);
    
    const tech = await Technician.findOne({ user: user._id });
    if (!tech) {
      console.log('❌ Technician profile not found');
      process.exit(0);
    }
    
    console.log('\nCurrent data:');
    console.log('  Location:', JSON.stringify(tech.location));
    console.log('  Skills:', tech.skills);
    console.log('  Available:', tech.isAvailable);
    
    // Update to Colombo 3 (Galle Road area)
    tech.location = {
      type: 'Point',
      coordinates: [79.8612, 6.9271] // [lng, lat] - Colombo
    };
    tech.isAvailable = true;
    
    await tech.save();
    
    console.log('\n✅ Updated Wajira\'s location to Colombo');
    console.log('  New coordinates: [79.8612, 6.9271]');
    console.log('  (Latitude: 6.9271, Longitude: 79.8612)');
    console.log('  Location: Galle Road, Colombo 3 area');
    
    // Verify
    const updated = await Technician.findById(tech._id);
    console.log('\nVerification:', JSON.stringify(updated.location));
    
    console.log('\n🎉 Done! Now test:');
    console.log('1. Search "Cleaning" in Colombo → Should show Wajira with actual distance');
    console.log('2. Search "Cleaning" in Kandy → Should NOT show Wajira (too far)');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

updateWajira();
