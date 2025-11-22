require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Technician = require('../models/Technician');

const MONGO = process.env.MONGO_URI || 'mongodb+srv://qfix3184_db_user:D5dMh3sVcVljKgf0@quickfix.ad3tevk.mongodb.net/?appName=quickfix';

// Diverse locations across Sri Lanka
const locations = {
  colombo: { lat: 6.9271, lng: 79.8612, area: 'Colombo' },
  gampaha: { lat: 7.0873, lng: 80.0142, area: 'Gampaha' },
  kalutara: { lat: 6.5854, lng: 79.9607, area: 'Kalutara' },
  kandy: { lat: 7.2906, lng: 80.6337, area: 'Kandy' },
  matale: { lat: 7.4675, lng: 80.6234, area: 'Matale' },
  nuwara_eliya: { lat: 6.9497, lng: 80.7891, area: 'Nuwara Eliya' },
  galle: { lat: 6.0535, lng: 80.2210, area: 'Galle' },
  matara: { lat: 5.9549, lng: 80.5550, area: 'Matara' },
  hambantota: { lat: 6.1429, lng: 81.1212, area: 'Hambantota' },
  jaffna: { lat: 9.6615, lng: 80.0255, area: 'Jaffna' },
  kilinochchi: { lat: 9.3961, lng: 80.3981, area: 'Kilinochchi' },
  mannar: { lat: 8.9810, lng: 79.9044, area: 'Mannar' },
  vavuniya: { lat: 8.7542, lng: 80.4982, area: 'Vavuniya' },
  mullaitivu: { lat: 9.2671, lng: 80.8142, area: 'Mullaitivu' },
  batticaloa: { lat: 7.7310, lng: 81.6747, area: 'Batticaloa' },
  ampara: { lat: 7.2914, lng: 81.6747, area: 'Ampara' },
  trincomalee: { lat: 8.5874, lng: 81.2152, area: 'Trincomalee' },
  kurunegala: { lat: 7.4818, lng: 80.3609, area: 'Kurunegala' },
  puttalam: { lat: 8.0362, lng: 79.8283, area: 'Puttalam' },
  anuradhapura: { lat: 8.3114, lng: 80.4037, area: 'Anuradhapura' },
  polonnaruwa: { lat: 7.9403, lng: 81.0188, area: 'Polonnaruwa' },
  badulla: { lat: 6.9934, lng: 81.0550, area: 'Badulla' },
  monaragala: { lat: 6.8728, lng: 81.3507, area: 'Monaragala' },
  ratnapura: { lat: 6.7056, lng: 80.3847, area: 'Ratnapura' },
  kegalle: { lat: 7.2513, lng: 80.3464, area: 'Kegalle' }
};

async function updateTechnicianLocations() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB');

    // Get all technicians
    const technicians = await Technician.find().populate('user', 'name email');
    console.log(`\nFound ${technicians.length} technicians in database`);

    // Convert locations to array for random selection
    const locationArray = Object.values(locations);

    // Update each technician with a diverse location
    for (let i = 0; i < technicians.length; i++) {
      const tech = technicians[i];
      const location = locationArray[i % locationArray.length]; // Cycle through locations

      // Update location
      tech.location = {
        type: 'Point',
        coordinates: [location.lng, location.lat]
      };

      await tech.save();
      
      console.log(`✓ Updated ${tech.user?.name || 'Unknown'}: ${location.area} (${location.lat}, ${location.lng})`);
    }

    // Ensure geospatial index
    console.log('\nEnsuring geospatial index...');
    await Technician.collection.createIndex({ location: '2dsphere' });
    console.log('✓ Geospatial index ensured');

    // Show summary
    console.log('\n=== Summary ===');
    console.log(`Total technicians updated: ${technicians.length}`);
    console.log('Locations are now distributed across Sri Lanka');
    
    // Show sample distances
    console.log('\n=== Sample Distance Test ===');
    const colomboLoc = locations.colombo;
    const techsNearColombo = await Technician.find({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [colomboLoc.lng, colomboLoc.lat]
          },
          $maxDistance: 50000 // 50km in meters
        }
      }
    }).limit(3).populate('user', 'name');
    
    console.log(`\nTechnicians within 50km of Colombo:`);
    techsNearColombo.forEach(t => {
      console.log(`  - ${t.user?.name || 'Unknown'}`);
    });

    const polonnaruwaLoc = locations.polonnaruwa;
    const techsNearPolonnaruwa = await Technician.find({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [polonnaruwaLoc.lng, polonnaruwaLoc.lat]
          },
          $maxDistance: 50000 // 50km in meters
        }
      }
    }).limit(3).populate('user', 'name');
    
    console.log(`\nTechnicians within 50km of Polonnaruwa:`);
    techsNearPolonnaruwa.forEach(t => {
      console.log(`  - ${t.user?.name || 'Unknown'}`);
    });

    console.log('\n✓ Location update completed successfully!');
    console.log('\nNow test your app:');
    console.log('1. Enter a Gampaha address - you should see nearby technicians');
    console.log('2. Enter a Polonnaruwa address - you should see different technicians');
    
    process.exit(0);
  } catch (error) {
    console.error('Error updating technician locations:', error);
    process.exit(1);
  }
}

updateTechnicianLocations();
