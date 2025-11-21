require('dotenv').config();
const mongoose = require('mongoose');
const Technician = require('../models/Technician');
const User = require('../models/User');

const MONGO = process.env.MONGO_URI || 'mongodb+srv://qfix3184_db_user:D5dMh3sVcVljKgf0@quickfix.ad3tevk.mongodb.net/?appName=quickfix';

async function fixTechnicianData() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('✓ Connected to MongoDB\n');

    // Get all technicians
    const technicians = await Technician.find().populate('user', 'name email phone');
    console.log(`Found ${technicians.length} technicians in database\n`);

    if (technicians.length === 0) {
      console.log('No technicians found. Run seed-technicians.js first.');
      process.exit(0);
    }

    // Check each technician
    for (const tech of technicians) {
      console.log(`\n--- Checking: ${tech.user?.name || 'Unknown'} ---`);
      console.log(`Email: ${tech.user?.email}`);
      console.log(`Phone: ${tech.user?.phone}`);
      console.log(`Skills: ${tech.skills.join(', ')}`);
      console.log(`Available: ${tech.isAvailable}`);
      console.log(`Location: ${JSON.stringify(tech.location)}`);
      
      let needsUpdate = false;
      
      // Check if location is at default [0, 0]
      if (!tech.location || !tech.location.coordinates || 
          (tech.location.coordinates[0] === 0 && tech.location.coordinates[1] === 0)) {
        console.log(' Location is at default [0, 0]');
        
        // Set to Sri Lanka center as default
        tech.location = {
          type: 'Point',
          coordinates: [80.7718, 7.8731]
        };
        needsUpdate = true;
        console.log('✓ Updated location to Sri Lanka center [80.7718, 7.8731]');
      }
      
      // Ensure skills array is not empty
      if (!tech.skills || tech.skills.length === 0) {
        console.log('  No skills defined');
        tech.skills = ['general'];
        needsUpdate = true;
        console.log('✓ Added default skill: general');
      }
      
      // Ensure isAvailable is set
      if (tech.isAvailable === undefined || tech.isAvailable === null) {
        tech.isAvailable = true;
        needsUpdate = true;
        console.log('✓ Set isAvailable to true');
      }
      
      if (needsUpdate) {
        await tech.save();
        console.log('✓ Changes saved');
      } else {
        console.log('✓ No changes needed');
      }
    }

    // Ensure geospatial index
    console.log('\n\n--- Ensuring Geospatial Index ---');
    try {
      await Technician.collection.createIndex({ location: '2dsphere' });
      console.log('✓ Geospatial index created/verified');
    } catch (err) {
      console.log('Index might already exist:', err.message);
    }

    // Show indexes
    const indexes = await Technician.collection.indexes();
    console.log('\nCurrent indexes:');
    indexes.forEach(idx => {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)}`);
    });

    // Test query
    console.log('\n\n--- Testing Query ---');
    const testLat = 7.8731;
    const testLng = 80.7718;
    const testSkill = 'plumbing';
    
    console.log(`Searching for "${testSkill}" technicians near (${testLat}, ${testLng})`);
    
    const results = await Technician.find({
      isAvailable: true,
      skills: { $regex: new RegExp(testSkill, 'i') }
    }).populate('user', 'name phone').lean();
    
    console.log(`Found ${results.length} technicians with "${testSkill}" skill:`);
    results.forEach(tech => {
      console.log(`  - ${tech.user?.name}: ${tech.skills.join(', ')} at ${JSON.stringify(tech.location.coordinates)}`);
    });

    console.log('\n✓ Fix completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n Error:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

fixTechnicianData();
