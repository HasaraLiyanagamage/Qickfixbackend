require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Technician = require('../models/Technician');
const bcrypt = require('bcryptjs');

const MONGO = process.env.MONGO_URI || 'mongodb+srv://qfix3184_db_user:D5dMh3sVcVljKgf0@quickfix.ad3tevk.mongodb.net/?appName=quickfix';

// Sample technicians data
const sampleTechnicians = [
  {
    name: 'John Plumber',
    email: 'john.plumber@test.com',
    password: 'password123',
    phone: '+94771234567',
    skills: ['plumbing', 'pipe repair'],
    lat: 7.8731, // Sri Lanka center
    lng: 80.7718,
    isAvailable: true
  },
  {
    name: 'Sarah Electrician',
    email: 'sarah.electric@test.com',
    password: 'password123',
    phone: '+94771234568',
    skills: ['electrical', 'wiring'],
    lat: 6.9271, // Colombo
    lng: 79.8612,
    isAvailable: true
  },
  {
    name: 'Mike Carpenter',
    email: 'mike.carpenter@test.com',
    password: 'password123',
    phone: '+94771234569',
    skills: ['carpentry', 'furniture'],
    lat: 7.2906, // Kandy
    lng: 80.6337,
    isAvailable: true
  },
  {
    name: 'Lisa Painter',
    email: 'lisa.painter@test.com',
    password: 'password123',
    phone: '+94771234570',
    skills: ['painting', 'interior design'],
    lat: 7.0873, // Gampaha
    lng: 80.0142,
    isAvailable: true
  }
];

async function seedTechnicians() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB');

    // Check existing technicians
    const existingCount = await Technician.countDocuments();
    console.log(`Existing technicians in database: ${existingCount}`);

    for (const techData of sampleTechnicians) {
      // Check if user already exists
      let user = await User.findOne({ email: techData.email });
      
      if (!user) {
        console.log(`Creating user: ${techData.name}`);
        const hashedPassword = await bcrypt.hash(techData.password, 10);
        user = new User({
          name: techData.name,
          email: techData.email,
          passwordHash: hashedPassword,
          phone: techData.phone,
          role: 'technician'
        });
        await user.save();
        console.log(`✓ User created: ${techData.name}`);
      } else {
        console.log(`User already exists: ${techData.name}`);
      }

      // Check if technician profile exists
      let technician = await Technician.findOne({ user: user._id });
      
      if (!technician) {
        console.log(`Creating technician profile for: ${techData.name}`);
        technician = new Technician({
          user: user._id,
          skills: techData.skills,
          rating: 4.5 + Math.random() * 0.5, // Random rating between 4.5-5.0
          isAvailable: techData.isAvailable,
          location: {
            type: 'Point',
            coordinates: [techData.lng, techData.lat]
          }
        });
        await technician.save();
        console.log(`✓ Technician profile created: ${techData.name} with skills: ${techData.skills.join(', ')}`);
      } else {
        // Update existing technician
        technician.skills = techData.skills;
        technician.isAvailable = techData.isAvailable;
        technician.location = {
          type: 'Point',
          coordinates: [techData.lng, techData.lat]
        };
        await technician.save();
        console.log(`✓ Technician profile updated: ${techData.name}`);
      }
    }

    // Ensure geospatial index
    console.log('\nEnsuring geospatial index...');
    await Technician.collection.createIndex({ location: '2dsphere' });
    console.log('✓ Geospatial index ensured');

    // Show final count
    const finalCount = await Technician.countDocuments();
    const availableCount = await Technician.countDocuments({ isAvailable: true });
    console.log(`\n=== Summary ===`);
    console.log(`Total technicians: ${finalCount}`);
    console.log(`Available technicians: ${availableCount}`);
    
    // Show technicians by skill
    const skills = ['plumbing', 'electrical', 'carpentry', 'painting'];
    for (const skill of skills) {
      const count = await Technician.countDocuments({ 
        skills: { $in: [new RegExp(`^${skill}$`, 'i')] }
      });
      console.log(`Technicians with "${skill}" skill: ${count}`);
    }

    console.log('\n✓ Seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding technicians:', error);
    process.exit(1);
  }
}

seedTechnicians();
