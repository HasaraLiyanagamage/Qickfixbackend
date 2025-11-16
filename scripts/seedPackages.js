const mongoose = require('mongoose');
const ServicePackage = require('../models/ServicePackage');
require('dotenv').config();

const packages = [
  {
    name: 'Basic Home Maintenance',
    description: 'Essential home maintenance services for everyday needs',
    type: 'basic',
    price: 2500,
    duration: 60,
    services: [
      'General plumbing inspection',
      'Electrical outlet check',
      'Door and window adjustment',
      'Minor repairs',
      'Safety inspection'
    ],
    discount: 0,
    isActive: true
  },
  {
    name: 'Standard Home Care',
    description: 'Comprehensive home care package with multiple services',
    type: 'standard',
    price: 4500,
    duration: 120,
    services: [
      'Complete plumbing inspection and minor repairs',
      'Electrical system check and fixes',
      'Carpentry work (up to 2 hours)',
      'Painting touch-ups',
      'AC filter cleaning',
      'Door lock maintenance',
      'Priority scheduling'
    ],
    discount: 10,
    isActive: true
  },
  {
    name: 'Premium Full Service',
    description: 'Complete home service package with premium benefits',
    type: 'premium',
    price: 7500,
    duration: 240,
    services: [
      'Full plumbing system inspection and repairs',
      'Complete electrical system audit',
      'Carpentry work (up to 4 hours)',
      'Interior painting (1 room)',
      'AC servicing and cleaning',
      'Complete lock system check',
      'Appliance maintenance',
      'Emergency support (24/7)',
      'Free follow-up visit within 7 days',
      'Priority technician assignment'
    ],
    discount: 20,
    isActive: true
  },
  {
    name: 'Emergency Response Package',
    description: 'Immediate emergency service with priority response',
    type: 'emergency',
    price: 5000,
    duration: 90,
    services: [
      'Immediate dispatch (within 15 minutes)',
      'Emergency plumbing repairs',
      'Emergency electrical fixes',
      'Emergency locksmith service',
      'Available 24/7',
      'No surge pricing',
      'Priority technician'
    ],
    discount: 0,
    isActive: true
  },
  {
    name: 'Monthly Maintenance Plan',
    description: 'Regular monthly maintenance for your home',
    type: 'subscription',
    price: 3500,
    duration: 90,
    services: [
      'Monthly home inspection',
      'Plumbing check and maintenance',
      'Electrical safety inspection',
      'AC filter replacement',
      'Minor repairs included',
      '10% discount on additional services',
      'Priority booking',
      'Free consultation calls'
    ],
    discount: 15,
    isActive: true
  },
  {
    name: 'Deep Cleaning & Maintenance',
    description: 'Thorough cleaning combined with maintenance services',
    type: 'standard',
    price: 6000,
    duration: 180,
    services: [
      'Deep cleaning (entire home)',
      'Plumbing system cleaning',
      'Electrical fixture cleaning',
      'AC deep cleaning',
      'Window and door cleaning',
      'Minor repairs during service',
      'Sanitization included'
    ],
    discount: 12,
    isActive: true
  }
];

async function seedPackages() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/quickfix', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('Connected to MongoDB');
    
    // Clear existing packages
    await ServicePackage.deleteMany({});
    console.log('Cleared existing packages');
    
    // Insert new packages
    const result = await ServicePackage.insertMany(packages);
    console.log(`✅ Successfully created ${result.length} service packages:`);
    
    result.forEach((pkg, index) => {
      console.log(`\n${index + 1}. ${pkg.name}`);
      console.log(`   Type: ${pkg.type.toUpperCase()}`);
      console.log(`   Price: LKR ${pkg.price}`);
      console.log(`   Duration: ${pkg.duration} minutes`);
      console.log(`   Services: ${pkg.services.length} included`);
      console.log(`   Discount: ${pkg.discount}%`);
    });
    
    console.log('\n✅ Package seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding packages:', error);
    process.exit(1);
  }
}

// Run the seed function
seedPackages();
