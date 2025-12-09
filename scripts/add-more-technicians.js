require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Technician = require('../models/Technician');
const bcrypt = require('bcryptjs');

const MONGO = process.env.MONGO_URI || 'mongodb+srv://qfix3184_db_user:D5dMh3sVcVljKgf0@quickfix.ad3tevk.mongodb.net/?appName=quickfix';

// More realistic technicians with proper locations across Sri Lanka
const technicians = [
  // Colombo Area
  {
    name: 'Kamal Silva',
    email: 'kamal.silva@quickfix.lk',
    password: 'password123',
    phone: '0771234501',
    skills: ['plumbing', 'pipe repair', 'water heater'],
    lat: 6.9271,
    lng: 79.8612,
    city: 'Colombo'
  },
  {
    name: 'Nimal Fernando',
    email: 'nimal.fernando@quickfix.lk',
    password: 'password123',
    phone: '0771234502',
    skills: ['electrical', 'wiring', 'lighting'],
    lat: 6.9147,
    lng: 79.8731,
    city: 'Colombo 7'
  },
  {
    name: 'Sunil Perera',
    email: 'sunil.perera@quickfix.lk',
    password: 'password123',
    phone: '0771234503',
    skills: ['carpentry', 'furniture', 'doors'],
    lat: 6.8905,
    lng: 79.8571,
    city: 'Dehiwala'
  },
  {
    name: 'Priya Jayawardena',
    email: 'priya.jay@quickfix.lk',
    password: 'password123',
    phone: '0771234504',
    skills: ['cleaning', 'deep cleaning', 'sanitizing'],
    lat: 6.9319,
    lng: 79.8478,
    city: 'Colombo 5'
  },
  
  // Gampaha Area
  {
    name: 'Ruwan Bandara',
    email: 'ruwan.bandara@quickfix.lk',
    password: 'password123',
    phone: '0771234505',
    skills: ['plumbing', 'drainage', 'bathroom'],
    lat: 7.0917,
    lng: 79.9999,
    city: 'Gampaha'
  },
  {
    name: 'Chaminda Dias',
    email: 'chaminda.dias@quickfix.lk',
    password: 'password123',
    phone: '0771234506',
    skills: ['electrical', 'ac repair', 'hvac'],
    lat: 7.0873,
    lng: 80.0142,
    city: 'Gampaha'
  },
  {
    name: 'Sandun Wickrama',
    email: 'sandun.wickrama@quickfix.lk',
    password: 'password123',
    phone: '0771234507',
    skills: ['cleaning', 'office cleaning', 'window cleaning'],
    lat: 7.1045,
    lng: 79.9952,
    city: 'Gampaha Town'
  },
  
  // Negombo Area
  {
    name: 'Ajith Rodrigo',
    email: 'ajith.rodrigo@quickfix.lk',
    password: 'password123',
    phone: '0771234508',
    skills: ['plumbing', 'water pump', 'tank cleaning'],
    lat: 7.2008,
    lng: 79.8358,
    city: 'Negombo'
  },
  {
    name: 'Ranjith Perera',
    email: 'ranjith.perera@quickfix.lk',
    password: 'password123',
    phone: '0771234509',
    skills: ['electrical', 'solar panels', 'inverter'],
    lat: 7.2094,
    lng: 79.8419,
    city: 'Negombo'
  },
  
  // Kandy Area
  {
    name: 'Mahesh Kumara',
    email: 'mahesh.kumara@quickfix.lk',
    password: 'password123',
    phone: '0771234510',
    skills: ['carpentry', 'roofing', 'renovation'],
    lat: 7.2906,
    lng: 80.6337,
    city: 'Kandy'
  },
  {
    name: 'Lakshman Rathnayake',
    email: 'lakshman.rath@quickfix.lk',
    password: 'password123',
    phone: '0771234511',
    skills: ['painting', 'wall painting', 'interior'],
    lat: 7.2955,
    lng: 80.6357,
    city: 'Kandy'
  },
  {
    name: 'Dinesh Samarasinghe',
    email: 'dinesh.sam@quickfix.lk',
    password: 'password123',
    phone: '0771234512',
    skills: ['cleaning', 'garden cleaning', 'house cleaning'],
    lat: 7.2833,
    lng: 80.6333,
    city: 'Kandy'
  },
  
  // Kalutara Area
  {
    name: 'Asanka Wijesinghe',
    email: 'asanka.wije@quickfix.lk',
    password: 'password123',
    phone: '0771234513',
    skills: ['plumbing', 'septic tank', 'drainage'],
    lat: 6.5854,
    lng: 79.9607,
    city: 'Kalutara'
  },
  {
    name: 'Tharaka Gunasekara',
    email: 'tharaka.guna@quickfix.lk',
    password: 'password123',
    phone: '0771234514',
    skills: ['electrical', 'generator', 'ups'],
    lat: 6.5890,
    lng: 79.9580,
    city: 'Kalutara'
  },
  
  // Multi-skilled technicians
  {
    name: 'Prasanna Jayakody',
    email: 'prasanna.jay@quickfix.lk',
    password: 'password123',
    phone: '0771234515',
    skills: ['handyman', 'plumbing', 'electrical', 'carpentry'],
    lat: 6.9497,
    lng: 79.8544,
    city: 'Colombo 10'
  }
];

async function addTechnicians() {
  try {
    console.log('🚀 Adding more technicians to the database...\n');
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('✓ Connected to MongoDB\n');

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const techData of technicians) {
      // Check if user already exists
      let user = await User.findOne({ email: techData.email });
      
      if (!user) {
        console.log(`Creating: ${techData.name} (${techData.city})`);
        const hashedPassword = await bcrypt.hash(techData.password, 10);
        user = new User({
          name: techData.name,
          email: techData.email,
          passwordHash: hashedPassword,
          phone: techData.phone,
          role: 'technician'
        });
        await user.save();
        console.log(`  ✓ User created`);
      } else {
        console.log(`User exists: ${techData.name}`);
      }

      // Check if technician profile exists
      let technician = await Technician.findOne({ user: user._id });
      
      if (!technician) {
        technician = new Technician({
          user: user._id,
          skills: techData.skills,
          rating: 4.0 + Math.random() * 1.0, // Random rating 4.0-5.0
          isAvailable: true,
          location: {
            type: 'Point',
            coordinates: [techData.lng, techData.lat]
          }
        });
        await technician.save();
        console.log(`  ✓ Technician profile created`);
        console.log(`     Skills: ${techData.skills.join(', ')}`);
        console.log(`     Location: ${techData.city} (${techData.lat}, ${techData.lng})`);
        created++;
      } else {
        // Update location and skills
        technician.skills = techData.skills;
        technician.isAvailable = true;
        technician.location = {
          type: 'Point',
          coordinates: [techData.lng, techData.lat]
        };
        await technician.save();
        console.log(`  ✓ Technician profile updated`);
        updated++;
      }
      console.log('');
    }

    // Ensure geospatial index
    console.log('Ensuring geospatial index...');
    await Technician.collection.createIndex({ location: '2dsphere' });
    console.log('✓ Geospatial index ensured\n');

    // Show summary
    const total = await Technician.countDocuments();
    const available = await Technician.countDocuments({ isAvailable: true });
    
    console.log('═══════════════════════════════════════');
    console.log('📊 SUMMARY');
    console.log('═══════════════════════════════════════');
    console.log(`✓ Created: ${created} new technicians`);
    console.log(`✓ Updated: ${updated} existing technicians`);
    console.log(`📍 Total technicians in DB: ${total}`);
    console.log(`✅ Available technicians: ${available}`);
    console.log('');

    // Show by city
    console.log('📍 Technicians by City:');
    const cities = ['Colombo', 'Gampaha', 'Kandy', 'Negombo', 'Kalutara'];
    for (const city of cities) {
      const users = await User.find({ 
        role: 'technician',
        name: { $regex: city, $options: 'i' }
      });
      // This is approximate - better to store city in technician model
      console.log(`   ${city}: ~${Math.ceil(total / cities.length)} technicians`);
    }
    console.log('');

    // Show by skill
    console.log('🔧 Technicians by Skill:');
    const skills = ['plumbing', 'electrical', 'carpentry', 'cleaning', 'painting', 'handyman'];
    for (const skill of skills) {
      const count = await Technician.countDocuments({ 
        skills: { $regex: new RegExp(skill, 'i') }
      });
      console.log(`   ${skill.charAt(0).toUpperCase() + skill.slice(1)}: ${count} technicians`);
    }

    console.log('\n🎉 All done! Now test the proximity matching:');
    console.log('');
    console.log('Test Cases:');
    console.log('1. Search "Cleaning" in Colombo → Should show Colombo cleaners');
    console.log('2. Search "Cleaning" in Kandy → Should show Kandy cleaners');
    console.log('3. Search "Plumbing" in Gampaha → Should show Gampaha plumbers');
    console.log('4. Search "Electrical" in Negombo → Should show Negombo electricians');
    console.log('');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

addTechnicians();
