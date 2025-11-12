const { Referral, ReferralReward } = require('../models/Referral');
const walletService = require('./walletService');

class ReferralService {
  constructor() {
    // Referral reward configuration
    this.config = {
      referrerReward: 500, // LKR for referrer
      referredReward: 200, // LKR for new user
      rewardType: 'credit', // credit, discount, cashback
      requireFirstBooking: true, // Reward only after first booking
      expiryDays: 90 // Reward expiry in days
    };
  }

  /**
   * Generate unique referral code
   * @param {String} userId - User ID
   * @returns {String} Referral code
   */
  generateReferralCode(userId) {
    // Generate code from user ID and random string
    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    const userPart = userId.toString().substring(userId.length - 4);
    return `QF${userPart}${randomPart}`;
  }

  /**
   * Get or create referral record for user
   * @param {String} userId - User ID
   * @returns {Object} Referral record
   */
  async getOrCreateReferral(userId) {
    let referral = await Referral.findOne({ referrer: userId });
    
    if (!referral) {
      const code = this.generateReferralCode(userId);
      referral = await Referral.create({
        referrer: userId,
        referralCode: code,
        referred: [],
        totalReferrals: 0,
        successfulReferrals: 0,
        totalRewardsEarned: 0
      });
    }
    
    return referral;
  }

  /**
   * Apply referral code for new user
   * @param {String} newUserId - New user ID
   * @param {String} referralCode - Referral code
   * @returns {Object} Result
   */
  async applyReferralCode(newUserId, referralCode) {
    // Find referral by code
    const referral = await Referral.findOne({ 
      referralCode: referralCode.toUpperCase() 
    });

    if (!referral) {
      throw new Error('Invalid referral code');
    }

    // Check if user is trying to use their own code
    if (referral.referrer.toString() === newUserId.toString()) {
      throw new Error('Cannot use your own referral code');
    }

    // Check if user already used a referral code
    const existingReferral = await Referral.findOne({
      'referred.user': newUserId
    });

    if (existingReferral) {
      throw new Error('You have already used a referral code');
    }

    // Add new user to referred list
    referral.referred.push({
      user: newUserId,
      joinedAt: new Date(),
      firstBookingCompleted: false,
      rewardClaimed: false
    });
    referral.totalReferrals += 1;
    await referral.save();

    // If first booking is not required, credit rewards immediately
    if (!this.config.requireFirstBooking) {
      await this.creditReferralRewards(referral.referrer, newUserId, referralCode);
    }

    return {
      success: true,
      message: 'Referral code applied successfully',
      reward: this.config.requireFirstBooking 
        ? 'Reward will be credited after your first booking'
        : `LKR ${this.config.referredReward} credited to your wallet`
    };
  }

  /**
   * Mark first booking as completed and credit rewards
   * @param {String} userId - User ID who completed first booking
   * @returns {Object} Result
   */
  async handleFirstBookingCompleted(userId) {
    // Find referral where this user was referred
    const referral = await Referral.findOne({
      'referred.user': userId,
      'referred.firstBookingCompleted': false
    });

    if (!referral) {
      return { success: false, message: 'No pending referral rewards' };
    }

    // Update referred user record
    const referredUser = referral.referred.find(
      r => r.user.toString() === userId.toString()
    );
    
    if (referredUser) {
      referredUser.firstBookingCompleted = true;
      referral.successfulReferrals += 1;
      await referral.save();

      // Credit rewards to both parties
      await this.creditReferralRewards(
        referral.referrer, 
        userId, 
        referral.referralCode
      );

      return {
        success: true,
        message: 'Referral rewards credited',
        referrerReward: this.config.referrerReward,
        referredReward: this.config.referredReward
      };
    }

    return { success: false, message: 'Referral record not found' };
  }

  /**
   * Credit referral rewards to both parties
   * @param {String} referrerId - Referrer user ID
   * @param {String} referredId - Referred user ID
   * @param {String} referralCode - Referral code
   */
  async creditReferralRewards(referrerId, referredId, referralCode) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.config.expiryDays);

    // Create reward records
    const referrerReward = await ReferralReward.create({
      referral: (await Referral.findOne({ referrer: referrerId }))._id,
      referrer: referrerId,
      referred: referredId,
      rewardType: this.config.rewardType,
      amount: this.config.referrerReward,
      status: 'pending',
      expiresAt
    });

    const referredReward = await ReferralReward.create({
      referral: (await Referral.findOne({ referrer: referrerId }))._id,
      referrer: referrerId,
      referred: referredId,
      rewardType: this.config.rewardType,
      amount: this.config.referredReward,
      status: 'pending',
      expiresAt
    });

    // Credit to wallets
    try {
      // Credit referrer
      await walletService.addReferralBonus(
        referrerId,
        this.config.referrerReward,
        referralCode
      );
      referrerReward.status = 'credited';
      referrerReward.creditedAt = new Date();
      await referrerReward.save();

      // Credit referred user
      await walletService.addReferralBonus(
        referredId,
        this.config.referredReward,
        referralCode
      );
      referredReward.status = 'credited';
      referredReward.creditedAt = new Date();
      await referredReward.save();

      // Update total rewards earned
      const referral = await Referral.findOne({ referrer: referrerId });
      referral.totalRewardsEarned += this.config.referrerReward;
      await referral.save();

    } catch (error) {
      console.error('Error crediting referral rewards:', error);
      throw error;
    }
  }

  /**
   * Get referral statistics for user
   * @param {String} userId - User ID
   * @returns {Object} Statistics
   */
  async getReferralStats(userId) {
    const referral = await this.getOrCreateReferral(userId);
    
    const rewards = await ReferralReward.find({
      referrer: userId,
      status: 'credited'
    });

    return {
      referralCode: referral.referralCode,
      totalReferrals: referral.totalReferrals,
      successfulReferrals: referral.successfulReferrals,
      pendingReferrals: referral.totalReferrals - referral.successfulReferrals,
      totalRewardsEarned: referral.totalRewardsEarned,
      rewardPerReferral: this.config.referrerReward,
      referred: referral.referred.map(r => ({
        userId: r.user,
        joinedAt: r.joinedAt,
        firstBookingCompleted: r.firstBookingCompleted,
        rewardClaimed: r.rewardClaimed
      }))
    };
  }

  /**
   * Get leaderboard of top referrers
   * @param {Number} limit - Number of top referrers
   * @returns {Array} Leaderboard
   */
  async getLeaderboard(limit = 10) {
    const topReferrers = await Referral.find()
      .sort({ successfulReferrals: -1, totalRewardsEarned: -1 })
      .limit(limit)
      .populate('referrer', 'name email');

    return topReferrers.map((r, index) => ({
      rank: index + 1,
      userId: r.referrer._id,
      name: r.referrer.name,
      referralCode: r.referralCode,
      successfulReferrals: r.successfulReferrals,
      totalRewardsEarned: r.totalRewardsEarned
    }));
  }

  /**
   * Update referral configuration (admin only)
   * @param {Object} newConfig - New configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   * @returns {Object} Configuration
   */
  getConfig() {
    return this.config;
  }
}

module.exports = new ReferralService();
