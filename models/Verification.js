const mongoose = require('mongoose');

const VerificationSchema = new mongoose.Schema({
  technician: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Technician',
    required: true
  },
  
  // Document types
  documents: {
    // ID Proof
    idProof: {
      type: { type: String, enum: ['national_id', 'passport', 'driving_license'] },
      number: String,
      frontImage: String,  // URL to uploaded image
      backImage: String,
      verified: { type: Boolean, default: false },
      verifiedAt: Date,
      verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    },
    
    // Qualification Certificates
    qualifications: [{
      type: { type: String }, // e.g., 'Electrician License', 'Plumbing Certificate'
      institution: String,
      issueDate: Date,
      expiryDate: Date,
      certificateNumber: String,
      documentUrl: String,
      verified: { type: Boolean, default: false },
      verifiedAt: Date,
      verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }],
    
    // Trade License
    tradeLicense: {
      licenseNumber: String,
      issueDate: Date,
      expiryDate: Date,
      issuingAuthority: String,
      documentUrl: String,
      verified: { type: Boolean, default: false },
      verifiedAt: Date,
      verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    },
    
    // Police Clearance (optional)
    policeClearance: {
      certificateNumber: String,
      issueDate: Date,
      expiryDate: Date,
      documentUrl: String,
      verified: { type: Boolean, default: false },
      verifiedAt: Date,
      verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    },
    
    // Address Proof
    addressProof: {
      type: { type: String, enum: ['utility_bill', 'bank_statement', 'rental_agreement'] },
      documentUrl: String,
      verified: { type: Boolean, default: false },
      verifiedAt: Date,
      verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }
  },
  
  // Verification status
  status: {
    type: String,
    enum: ['pending', 'under_review', 'approved', 'rejected', 'resubmission_required'],
    default: 'pending'
  },
  
  // Overall verification
  isVerified: { type: Boolean, default: false },
  verificationLevel: {
    type: String,
    enum: ['none', 'basic', 'standard', 'premium'],
    default: 'none'
  },
  
  // Verification score (0-100)
  verificationScore: { type: Number, default: 0 },
  
  // Admin notes
  adminNotes: [{
    note: String,
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    addedAt: { type: Date, default: Date.now }
  }],
  
  // Rejection details
  rejection: {
    reason: String,
    details: String,
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rejectedAt: Date,
    canResubmit: { type: Boolean, default: true }
  },
  
  // Resubmission tracking
  resubmissions: [{
    submittedAt: Date,
    status: String,
    notes: String
  }],
  
  // Verification dates
  submittedAt: { type: Date, default: Date.now },
  reviewStartedAt: Date,
  completedAt: Date,
  
  // Expiry tracking
  expiryDate: Date,
  reminderSent: { type: Boolean, default: false },
  
  // Background check (future feature)
  backgroundCheck: {
    status: { type: String, enum: ['not_started', 'in_progress', 'completed', 'failed'] },
    provider: String,
    completedAt: Date,
    result: String
  }
}, {
  timestamps: true
});

// Calculate verification score
VerificationSchema.methods.calculateScore = function() {
  let score = 0;
  
  // ID Proof (30 points)
  if (this.documents.idProof?.verified) score += 30;
  
  // Qualifications (25 points)
  const verifiedQuals = this.documents.qualifications?.filter(q => q.verified).length || 0;
  score += Math.min(verifiedQuals * 10, 25);
  
  // Trade License (25 points)
  if (this.documents.tradeLicense?.verified) score += 25;
  
  // Police Clearance (10 points)
  if (this.documents.policeClearance?.verified) score += 10;
  
  // Address Proof (10 points)
  if (this.documents.addressProof?.verified) score += 10;
  
  this.verificationScore = score;
  
  // Set verification level based on score
  if (score >= 80) this.verificationLevel = 'premium';
  else if (score >= 60) this.verificationLevel = 'standard';
  else if (score >= 30) this.verificationLevel = 'basic';
  else this.verificationLevel = 'none';
  
  return score;
};

// Check if verification is complete
VerificationSchema.methods.isComplete = function() {
  return this.documents.idProof?.verified && 
         this.documents.tradeLicense?.verified;
};

// Check if documents are expired
VerificationSchema.methods.checkExpiry = function() {
  const now = new Date();
  const expiringDocs = [];
  
  // Check trade license
  if (this.documents.tradeLicense?.expiryDate) {
    const daysUntilExpiry = Math.floor(
      (this.documents.tradeLicense.expiryDate - now) / (1000 * 60 * 60 * 24)
    );
    if (daysUntilExpiry <= 30) {
      expiringDocs.push({ type: 'Trade License', daysLeft: daysUntilExpiry });
    }
  }
  
  // Check qualifications
  this.documents.qualifications?.forEach(qual => {
    if (qual.expiryDate) {
      const daysUntilExpiry = Math.floor(
        (qual.expiryDate - now) / (1000 * 60 * 60 * 24)
      );
      if (daysUntilExpiry <= 30) {
        expiringDocs.push({ type: qual.type, daysLeft: daysUntilExpiry });
      }
    }
  });
  
  return expiringDocs;
};

// Indexes
VerificationSchema.index({ technician: 1 });
VerificationSchema.index({ status: 1 });
VerificationSchema.index({ isVerified: 1 });
VerificationSchema.index({ verificationLevel: 1 });

module.exports = mongoose.model('Verification', VerificationSchema);
