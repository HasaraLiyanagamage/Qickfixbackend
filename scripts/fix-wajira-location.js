require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Technician = require('../models/Technician');

const MONGO = process.env.MONGO_URI || 'mongodb+srv://qfix3184_db_user:D5dMh3sVcVljKgf0@quickfix.ad3tevk.mongodb.net/?appName=quickfix';

// Sri Lankan city coordinates
const locations = {
  colombo: { lat: 6.9271, lng: 79.8612, name: 'Colombo' },
  gampaha: { lat: 7.0917, lng: 79.9999, name: 'Gampaha' },
  kandy: { lat: 7.2906, lng: 80.6337, name: 'Kandy' },
  negombo: { lat: 7.2008, lng: 79.8358, name: 'Negombo' },
  kalutara: { lat: 6.5854, lng: 79.9607, name: 'Kalutara' }
};

async function fixWajiraLocation() {
  try {
    console.log('🔧 Fixing Wajira Perera\'s location...\n');
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('✓ Connected to MongoDB\n');

    // Find Wajira's user account
    const wajiraUser = await User.findOne({ 
      $or: [
        { name: /wajira/i },
        { email: /wajira/i }
      ]
    });

    if (!wajiraUser) {
      console.log('❌ Wajira user not found in database');
      console.log('Listing all technician users:');
      const allUsers = await User.find({ role: 'technician' });
      allUsers.forEach(u => console.log(`  - ${u.name} (${u.email})`));
      process.exit(0);
    }

    console.log(`✓ Found user: ${wajiraUser.name} (${wajiraUser.email})`);

    // Find technician profile
    let technician = await Technician.findOne({ user: wajiraUser._id });

    if (!technician) {
      console.log('❌ Technician profile not found');
      process.exit(1);
    }

    console.log(`\n📍 Current location: ${JSON.stringify(technician.location)}`);
    console.log(`   Skills: ${technician.skills.join(', ')}`);
    console.log(`   Available: ${technician.isAvailable}`);

    // Update to Colombo location (since they have cleaning skill, put them in Colombo)
    const newLocation = locations.colombo;
    
    technician.location = {
      type: 'Point',
      coordinates: [newLocation.lng, newLocation.lat]
    };
    
    // Ensure they're available
    technician.isAvailable = true;
    
    await technician.save();

    console.log(`\n✅ Updated Wajira's location to ${newLocation.name}`);
    console.log(`   New coordinates: [${newLocation.lng}, ${newLocation.lat}]`);
    console.log(`   (Longitude: ${newLocation.lng}, Latitude: ${newLocation.lat})`);

    // Verify the update
    const updated = await Technician.findById(technician._id);
    console.log(`\n✓ Verification: ${JSON.stringify(updated.location)}`);

    console.log('\n🎉 Fix completed successfully!');
    console.log('\nNow test:');
    console.log('1. Search for "Cleaning" service in Colombo → Should show Wajira');
    console.log('2. Search for "Cleaning" service in Kandy → Should NOT show Wajira (too far)');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixWajiraLocation();
