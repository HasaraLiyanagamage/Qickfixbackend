const express = require('express');
const router = express.Router();
const Verification = require('../models/Verification');
const Technician = require('../models/Technician');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'secretjwt';

// Auth middleware
function auth(req, res, next) {
  const hdr = req.headers.authorization;
  if (!hdr) return res.status(401).json({ message: 'Missing auth' });
  const token = hdr.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) { 
    return res.status(401).json({ message: 'Invalid token' }); 
  }
}

/**
 * Submit verification documents (Technician)
 * POST /api/verification/submit
 */
router.post('/submit', auth, async (req, res) => {
  try {
    if (req.user.role !== 'technician') {
      return res.status(403).json({ message: 'Only technicians can submit verification' });
    }

    const technician = await Technician.findOne({ user: req.user.userId });
    if (!technician) {
      return res.status(404).json({ message: 'Technician profile not found' });
    }

    const { documents } = req.body;

    // Check if verification already exists
    let verification = await Verification.findOne({ technician: technician._id });

    if (verification) {
      // Update existing verification
      verification.documents = { ...verification.documents, ...documents };
      verification.status = 'pending';
      verification.submittedAt = new Date();
      verification.resubmissions.push({
        submittedAt: new Date(),
        status: 'pending',
        notes: 'Resubmitted documents'
      });
    } else {
      // Create new verification
      verification = new Verification({
        technician: technician._id,
        documents,
        status: 'pending',
        submittedAt: new Date()
      });
    }

    await verification.save();

    res.json({
      success: true,
      message: 'Verification documents submitted successfully',
      verification: {
        id: verification._id,
        status: verification.status,
        submittedAt: verification.submittedAt
      }
    });

  } catch (error) {
    console.error('Verification submission error:', error);
    res.status(500).json({ message: 'Failed to submit verification', error: error.message });
  }
});

/**
 * Get verification status (Technician)
 * GET /api/verification/status
 */
router.get('/status', auth, async (req, res) => {
  try {
    if (req.user.role !== 'technician') {
      return res.status(403).json({ message: 'Only technicians can check verification status' });
    }

    const technician = await Technician.findOne({ user: req.user.userId });
    if (!technician) {
      return res.status(404).json({ message: 'Technician profile not found' });
    }

    const verification = await Verification.findOne({ technician: technician._id });

    if (!verification) {
      return res.json({
        status: 'not_started',
        message: 'No verification documents submitted yet'
      });
    }

    // Calculate score
    verification.calculateScore();

    res.json({
      verification: {
        id: verification._id,
        status: verification.status,
        isVerified: verification.isVerified,
        verificationLevel: verification.verificationLevel,
        verificationScore: verification.verificationScore,
        submittedAt: verification.submittedAt,
        completedAt: verification.completedAt,
        documents: {
          idProof: verification.documents.idProof?.verified || false,
          qualifications: verification.documents.qualifications?.filter(q => q.verified).length || 0,
          tradeLicense: verification.documents.tradeLicense?.verified || false,
          policeClearance: verification.documents.policeClearance?.verified || false,
          addressProof: verification.documents.addressProof?.verified || false
        },
        rejection: verification.rejection,
        expiringDocs: verification.checkExpiry()
      }
    });

  } catch (error) {
    console.error('Get verification status error:', error);
    res.status(500).json({ message: 'Failed to get verification status', error: error.message });
  }
});

/**
 * Get all pending verifications (Admin)
 * GET /api/verification/pending
 */
router.get('/pending', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const verifications = await Verification.find({
      status: { $in: ['pending', 'under_review'] }
    })
    .populate({
      path: 'technician',
      populate: { path: 'user', select: 'name email phone' }
    })
    .sort({ submittedAt: 1 });

    res.json({
      count: verifications.length,
      verifications: verifications.map(v => ({
        id: v._id,
        technician: {
          id: v.technician._id,
          name: v.technician.user.name,
          email: v.technician.user.email,
          phone: v.technician.user.phone,
          skills: v.technician.skills
        },
        status: v.status,
        submittedAt: v.submittedAt,
        documentsSubmitted: {
          idProof: !!v.documents.idProof?.frontImage,
          qualifications: v.documents.qualifications?.length || 0,
          tradeLicense: !!v.documents.tradeLicense?.documentUrl,
          policeClearance: !!v.documents.policeClearance?.documentUrl,
          addressProof: !!v.documents.addressProof?.documentUrl
        }
      }))
    });

  } catch (error) {
    console.error('Get pending verifications error:', error);
    res.status(500).json({ message: 'Failed to get pending verifications', error: error.message });
  }
});

/**
 * Get verification details (Admin)
 * GET /api/verification/:id
 */
router.get('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const verification = await Verification.findById(req.params.id)
      .populate({
        path: 'technician',
        populate: { path: 'user', select: 'name email phone' }
      });

    if (!verification) {
      return res.status(404).json({ message: 'Verification not found' });
    }

    res.json({ verification });

  } catch (error) {
    console.error('Get verification details error:', error);
    res.status(500).json({ message: 'Failed to get verification details', error: error.message });
  }
});

/**
 * Verify specific document (Admin)
 * POST /api/verification/:id/verify-document
 */
router.post('/:id/verify-document', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { documentType, documentIndex, verified, notes } = req.body;

    const verification = await Verification.findById(req.params.id);
    if (!verification) {
      return res.status(404).json({ message: 'Verification not found' });
    }

    // Update document verification status
    if (documentType === 'idProof') {
      verification.documents.idProof.verified = verified;
      verification.documents.idProof.verifiedAt = new Date();
      verification.documents.idProof.verifiedBy = req.user.userId;
    } else if (documentType === 'tradeLicense') {
      verification.documents.tradeLicense.verified = verified;
      verification.documents.tradeLicense.verifiedAt = new Date();
      verification.documents.tradeLicense.verifiedBy = req.user.userId;
    } else if (documentType === 'policeClearance') {
      verification.documents.policeClearance.verified = verified;
      verification.documents.policeClearance.verifiedAt = new Date();
      verification.documents.policeClearance.verifiedBy = req.user.userId;
    } else if (documentType === 'addressProof') {
      verification.documents.addressProof.verified = verified;
      verification.documents.addressProof.verifiedAt = new Date();
      verification.documents.addressProof.verifiedBy = req.user.userId;
    } else if (documentType === 'qualification' && documentIndex !== undefined) {
      verification.documents.qualifications[documentIndex].verified = verified;
      verification.documents.qualifications[documentIndex].verifiedAt = new Date();
      verification.documents.qualifications[documentIndex].verifiedBy = req.user.userId;
    }

    // Add admin note if provided
    if (notes) {
      verification.adminNotes.push({
        note: notes,
        addedBy: req.user.userId,
        addedAt: new Date()
      });
    }

    // Calculate new score
    verification.calculateScore();

    await verification.save();

    res.json({
      success: true,
      message: 'Document verification updated',
      verificationScore: verification.verificationScore,
      verificationLevel: verification.verificationLevel
    });

  } catch (error) {
    console.error('Verify document error:', error);
    res.status(500).json({ message: 'Failed to verify document', error: error.message });
  }
});

/**
 * Approve verification (Admin)
 * POST /api/verification/:id/approve
 */
router.post('/:id/approve', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { notes } = req.body;

    const verification = await Verification.findById(req.params.id);
    if (!verification) {
      return res.status(404).json({ message: 'Verification not found' });
    }

    // Update verification status
    verification.status = 'approved';
    verification.isVerified = true;
    verification.completedAt = new Date();
    verification.calculateScore();

    // Set expiry date (1 year from now)
    verification.expiryDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

    if (notes) {
      verification.adminNotes.push({
        note: notes,
        addedBy: req.user.userId,
        addedAt: new Date()
      });
    }

    await verification.save();

    // Update technician verification status
    const technician = await Technician.findById(verification.technician);
    if (technician) {
      technician.verification = {
        isVerified: true,
        verificationLevel: verification.verificationLevel,
        verificationScore: verification.verificationScore,
        verifiedAt: new Date(),
        expiryDate: verification.expiryDate
      };
      await technician.save();
    }

    res.json({
      success: true,
      message: 'Verification approved successfully',
      verification: {
        id: verification._id,
        status: verification.status,
        verificationLevel: verification.verificationLevel,
        verificationScore: verification.verificationScore
      }
    });

  } catch (error) {
    console.error('Approve verification error:', error);
    res.status(500).json({ message: 'Failed to approve verification', error: error.message });
  }
});

/**
 * Reject verification (Admin)
 * POST /api/verification/:id/reject
 */
router.post('/:id/reject', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { reason, details, canResubmit = true } = req.body;

    if (!reason) {
      return res.status(400).json({ message: 'Rejection reason is required' });
    }

    const verification = await Verification.findById(req.params.id);
    if (!verification) {
      return res.status(404).json({ message: 'Verification not found' });
    }

    // Update verification status
    verification.status = canResubmit ? 'resubmission_required' : 'rejected';
    verification.rejection = {
      reason,
      details,
      rejectedBy: req.user.userId,
      rejectedAt: new Date(),
      canResubmit
    };

    verification.adminNotes.push({
      note: `Rejected: ${reason}`,
      addedBy: req.user.userId,
      addedAt: new Date()
    });

    await verification.save();

    res.json({
      success: true,
      message: 'Verification rejected',
      canResubmit
    });

  } catch (error) {
    console.error('Reject verification error:', error);
    res.status(500).json({ message: 'Failed to reject verification', error: error.message });
  }
});

/**
 * Get verification statistics (Admin)
 * GET /api/verification/stats
 */
router.get('/admin/stats', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const stats = await Verification.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const verificationLevels = await Verification.aggregate([
      {
        $match: { isVerified: true }
      },
      {
        $group: {
          _id: '$verificationLevel',
          count: { $sum: 1 }
        }
      }
    ]);

    const avgScore = await Verification.aggregate([
      {
        $match: { isVerified: true }
      },
      {
        $group: {
          _id: null,
          avgScore: { $avg: '$verificationScore' }
        }
      }
    ]);

    res.json({
      statusBreakdown: stats,
      verificationLevels,
      averageScore: avgScore[0]?.avgScore || 0,
      totalVerifications: await Verification.countDocuments(),
      verifiedTechnicians: await Verification.countDocuments({ isVerified: true }),
      pendingReview: await Verification.countDocuments({ status: { $in: ['pending', 'under_review'] } })
    });

  } catch (error) {
    console.error('Get verification stats error:', error);
    res.status(500).json({ message: 'Failed to get verification stats', error: error.message });
  }
});

module.exports = router;
