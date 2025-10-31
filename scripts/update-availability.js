require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Technician = require('../models/Technician');

const MONGO = process.env.MONGO_URI || 'mongodb+srv://qfix3184_db_user:D5dMh3sVcVljKgf0@quickfix.ad3tevk.mongodb.net/?appName=quickfix';

async function updateAvailability() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB\n');

    // Get all unavailable technicians
    const unavailableTechs = await Technician.find({ isAvailable: false }).populate('user', 'name email');
    
    console.log(`Found ${unavailableTechs.length} unavailable technicians:\n`);
    unavailableTechs.forEach((tech, index) => {
      console.log(`${index + 1}. ${tech.user?.name} (${tech.user?.email})`);
      console.log(`   Skills: ${tech.skills.join(', ')}`);
    });

    console.log('\n--- Updating all to available ---\n');

    // Update all to available
    const result = await Technician.updateMany(
      { isAvailable: false },
      { $set: { isAvailable: true } }
    );

    console.log(`✓ Updated ${result.modifiedCount} technicians to available`);

    // Show summary
    const totalAvailable = await Technician.countDocuments({ isAvailable: true });
    const totalTechs = await Technician.countDocuments();
    
    console.log(`\n=== Summary ===`);
    console.log(`Total technicians: ${totalTechs}`);
    console.log(`Available: ${totalAvailable}`);
    console.log(`Unavailable: ${totalTechs - totalAvailable}`);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Ask for confirmation
const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('⚠️  This will set ALL unavailable technicians to available.');
readline.question('Continue? (yes/no): ', (answer) => {
  readline.close();
  if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
    updateAvailability();
  } else {
    console.log('Cancelled.');
    process.exit(0);
  }
});
