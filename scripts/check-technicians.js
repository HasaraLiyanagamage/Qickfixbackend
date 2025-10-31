require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Technician = require('../models/Technician');

const MONGO = process.env.MONGO_URI || 'mongodb+srv://qfix3184_db_user:D5dMh3sVcVljKgf0@quickfix.ad3tevk.mongodb.net/?appName=quickfix';

async function checkTechnicians() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB\n');

    const techs = await Technician.find().populate('user', 'name email phone');
    
    console.log(`=== ALL TECHNICIANS (${techs.length}) ===\n`);
    
    techs.forEach((tech, index) => {
      console.log(`${index + 1}. ${tech.user?.name || 'Unknown'}`);
      console.log(`   Email: ${tech.user?.email || 'N/A'}`);
      console.log(`   Phone: ${tech.user?.phone || 'N/A'}`);
      console.log(`   Skills: ${tech.skills.join(', ') || 'None'}`);
      console.log(`   Available: ${tech.isAvailable ? 'Yes' : 'No'}`);
      console.log(`   Rating: ${tech.rating}`);
      console.log(`   Location: [${tech.location?.coordinates?.[0]}, ${tech.location?.coordinates?.[1]}]`);
      console.log('');
    });

    // Group by availability
    const available = techs.filter(t => t.isAvailable);
    const unavailable = techs.filter(t => !t.isAvailable);
    
    console.log(`Available: ${available.length}`);
    console.log(`Unavailable: ${unavailable.length}`);
    
    // Group by skills
    console.log('\n=== SKILLS DISTRIBUTION ===');
    const skillsMap = {};
    techs.forEach(tech => {
      tech.skills.forEach(skill => {
        const normalizedSkill = skill.toLowerCase();
        skillsMap[normalizedSkill] = (skillsMap[normalizedSkill] || 0) + 1;
      });
    });
    
    Object.entries(skillsMap).sort((a, b) => b[1] - a[1]).forEach(([skill, count]) => {
      console.log(`${skill}: ${count}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkTechnicians();
