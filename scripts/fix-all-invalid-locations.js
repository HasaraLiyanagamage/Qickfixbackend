require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Technician = require('../models/Technician');

const MONGO = process.env.MONGO_URI || 'mongodb+srv://qfix3184_db_user:D5dMh3sVcVljKgf0@quickfix.ad3tevk.mongodb.net/?appName=quickfix';

// Default locations for technicians without valid coordinates
const defaultLocations = [
  { lat: 6.9271, lng: 79.8612, city: 'Colombo' },
  { lat: 7.0917, lng: 79.9999, city: 'Gampaha' },
  { lat: 7.2906, lng: 80.6337, city: 'Kandy' },
  { lat: 7.2008, lng: 79.8358, city: 'Negombo' },
  { lat: 6.5854, lng: 79.9607, city: 'Kalutara' }
];

function isValidLocation(coordinates) {
  if (!coordinates || coordinates.length !== 2) return false;
  const [lng, lat] = coordinates;
  
  // Check if coordinates are (0, 0) or invalid
  if (lat === 0 && lng === 0) return false;
  
  // Check if coordinates are within Sri Lanka bounds
  // Sri Lanka: Lat 5.9-9.9, Lng 79.5-82.0
  if (lat < 5.9 || lat > 9.9 || lng < 79.5 || lng > 82.0) return false;
  
  return true;
}

async function fixAllInvalidLocations() {
  try {
    console.log('🔧 Checking and fixing all invalid technician locations...\n');
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('✓ Connected to MongoDB\n');

    // Get all technicians
    const technicians = await Technician.find().populate('user', 'name email');
    console.log(`Found ${technicians.length} technicians in database\n`);

    let invalidCount = 0;
    let fixedCount = 0;
    let validCount = 0;

    console.log('═══════════════════════════════════════════════════════════');
    console.log('Checking each technician...\n');

    for (let i = 0; i < technicians.length; i++) {
      const tech = technicians[i];
      const userName = tech.user?.name || 'Unknown';
      const userEmail = tech.user?.email || 'Unknown';
      
      console.log(`[${i + 1}/${technicians.length}] ${userName} (${userEmail})`);
      
      const coords = tech.location?.coordinates;
      console.log(`   Current location: ${JSON.stringify(coords)}`);
      
      if (!isValidLocation(coords)) {
        console.log(`   ❌ INVALID LOCATION`);
        invalidCount++;
        
        // Assign a location based on index (distribute across cities)
        const locationIndex = fixedCount % defaultLocations.length;
        const newLocation = defaultLocations[locationIndex];
        
        tech.location = {
          type: 'Point',
          coordinates: [newLocation.lng, newLocation.lat]
        };
        
        // Ensure they're available
        tech.isAvailable = true;
        
        await tech.save();
        
        console.log(`   ✅ FIXED → ${newLocation.city} (${newLocation.lat}, ${newLocation.lng})`);
        fixedCount++;
      } else {
        const [lng, lat] = coords;
        console.log(`   ✓ Valid location (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
        validCount++;
      }
      console.log('');
    }

    // Ensure geospatial index
    console.log('Ensuring geospatial index...');
    await Technician.collection.createIndex({ location: '2dsphere' });
    console.log('✓ Geospatial index ensured\n');

    // Summary
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 SUMMARY');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Total technicians checked: ${technicians.length}`);
    console.log(`✓ Valid locations: ${validCount}`);
    console.log(`❌ Invalid locations found: ${invalidCount}`);
    console.log(`✅ Fixed locations: ${fixedCount}`);
    console.log('');

    if (fixedCount > 0) {
      console.log('📍 Fixed technicians distributed across:');
      defaultLocations.forEach(loc => {
        console.log(`   - ${loc.city}`);
      });
      console.log('');
    }

    // Verify all technicians now have valid locations
    const stillInvalid = await Technician.find().lean();
    const remainingInvalid = stillInvalid.filter(t => !isValidLocation(t.location?.coordinates));
    
    if (remainingInvalid.length > 0) {
      console.log(`⚠️  WARNING: ${remainingInvalid.length} technicians still have invalid locations!`);
    } else {
      console.log('✅ All technicians now have valid locations!');
    }

    console.log('\n🎉 Fix completed!');
    console.log('\nNext steps:');
    console.log('1. Restart your backend server');
    console.log('2. Test proximity matching with different addresses');
    console.log('3. Verify backend logs show distance calculations');
    console.log('');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixAllInvalidLocations();
