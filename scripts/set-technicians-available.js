require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Technician = require('../models/Technician');

const MONGO = process.env.MONGO_URI || 'mongodb+srv://qfix3184_db_user:D5dMh3sVcVljKgf0@quickfix.ad3tevk.mongodb.net/?appName=quickfix';

async function setTechniciansAvailable() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('✓ Connected to MongoDB\n');

    // Get all technicians
    const allTechs = await Technician.find().populate('user', 'name email');
    console.log(`Found ${allTechs.length} technicians in database\n`);

    // Update all to available
    const result = await Technician.updateMany(
      {},
      { $set: { isAvailable: true } }
    );

    console.log(`✓ Updated ${result.modifiedCount} technicians to available\n`);

    // Show updated status
    const updatedTechs = await Technician.find().populate('user', 'name email');
    console.log('=== Updated Technicians ===');
    updatedTechs.forEach(tech => {
      console.log(`- ${tech.user?.name}: ${tech.skills.join(', ')} - Available: ${tech.isAvailable}`);
    });

    // Test query
    console.log('\n=== Testing Plumbing Query ===');
    const plumbers = await Technician.find({
      isAvailable: true,
      skills: { $regex: new RegExp('plumbing', 'i') }
    }).populate('user', 'name phone');

    console.log(`Found ${plumbers.length} available plumbing technicians:`);
    plumbers.forEach(tech => {
      console.log(`- ${tech.user?.name}: ${tech.skills.join(', ')}`);
    });

    console.log('\n✓ All technicians are now available!');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

setTechniciansAvailable();
