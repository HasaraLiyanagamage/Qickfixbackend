const { Wallet, Transaction } = require('../models/Wallet');

class WalletService {
  /**
   * Get or create wallet for user
   * @param {String} userId - User ID
   * @returns {Object} Wallet
   */
  async getOrCreateWallet(userId) {
    let wallet = await Wallet.findOne({ user: userId });
    
    if (!wallet) {
      wallet = await Wallet.create({
        user: userId,
        balance: 0,
        currency: 'LKR',
        isActive: true
      });
    }
    
    return wallet;
  }

  /**
   * Get wallet balance
   * @param {String} userId - User ID
   * @returns {Number} Balance
   */
  async getBalance(userId) {
    const wallet = await this.getOrCreateWallet(userId);
    return wallet.balance;
  }

  /**
   * Add money to wallet
   * @param {String} userId - User ID
   * @param {Number} amount - Amount to add
   * @param {Object} metadata - Additional metadata
   * @returns {Object} Transaction
   */
  async addMoney(userId, amount, metadata = {}) {
    if (amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    const wallet = await this.getOrCreateWallet(userId);
    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore + amount;

    // Update wallet balance
    wallet.balance = balanceAfter;
    await wallet.save();

    // Create transaction record
    const transaction = await Transaction.create({
      wallet: wallet._id,
      type: 'credit',
      amount,
      category: 'top_up',
      description: 'Wallet top-up',
      status: 'completed',
      balanceBefore,
      balanceAfter,
      metadata
    });

    return transaction;
  }

  /**
   * Deduct money from wallet
   * @param {String} userId - User ID
   * @param {Number} amount - Amount to deduct
   * @param {String} category - Transaction category
   * @param {String} description - Description
   * @param {Object} metadata - Additional metadata
   * @returns {Object} Transaction
   */
  async deductMoney(userId, amount, category, description, metadata = {}) {
    if (amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }

    const wallet = await this.getOrCreateWallet(userId);
    
    if (wallet.balance < amount) {
      throw new Error('Insufficient wallet balance');
    }

    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore - amount;

    // Update wallet balance
    wallet.balance = balanceAfter;
    await wallet.save();

    // Create transaction record
    const transaction = await Transaction.create({
      wallet: wallet._id,
      type: 'debit',
      amount,
      category,
      description,
      status: 'completed',
      balanceBefore,
      balanceAfter,
      metadata
    });

    return transaction;
  }

  /**
   * Process booking payment from wallet
   * @param {String} userId - User ID
   * @param {String} bookingId - Booking ID
   * @param {Number} amount - Amount to pay
   * @returns {Object} Transaction
   */
  async payForBooking(userId, bookingId, amount) {
    return await this.deductMoney(
      userId,
      amount,
      'booking_payment',
      `Payment for booking #${bookingId}`,
      { booking: bookingId }
    );
  }

  /**
   * Process refund to wallet
   * @param {String} userId - User ID
   * @param {String} bookingId - Booking ID
   * @param {Number} amount - Refund amount
   * @returns {Object} Transaction
   */
  async refund(userId, bookingId, amount) {
    if (amount <= 0) {
      throw new Error('Refund amount must be greater than 0');
    }

    const wallet = await this.getOrCreateWallet(userId);
    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore + amount;

    // Update wallet balance
    wallet.balance = balanceAfter;
    await wallet.save();

    // Create transaction record
    const transaction = await Transaction.create({
      wallet: wallet._id,
      type: 'credit',
      amount,
      category: 'refund',
      description: `Refund for booking #${bookingId}`,
      status: 'completed',
      balanceBefore,
      balanceAfter,
      metadata: { booking: bookingId }
    });

    return transaction;
  }

  /**
   * Add referral bonus to wallet
   * @param {String} userId - User ID
   * @param {Number} amount - Bonus amount
   * @param {String} referralCode - Referral code
   * @returns {Object} Transaction
   */
  async addReferralBonus(userId, amount, referralCode) {
    const wallet = await this.getOrCreateWallet(userId);
    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore + amount;

    wallet.balance = balanceAfter;
    await wallet.save();

    const transaction = await Transaction.create({
      wallet: wallet._id,
      type: 'credit',
      amount,
      category: 'referral_bonus',
      description: `Referral bonus from code ${referralCode}`,
      status: 'completed',
      balanceBefore,
      balanceAfter,
      metadata: { referralCode }
    });

    return transaction;
  }

  /**
   * Add promo credit to wallet
   * @param {String} userId - User ID
   * @param {Number} amount - Credit amount
   * @param {String} promoCode - Promo code
   * @returns {Object} Transaction
   */
  async addPromoCredit(userId, amount, promoCode) {
    const wallet = await this.getOrCreateWallet(userId);
    const balanceBefore = wallet.balance;
    const balanceAfter = balanceBefore + amount;

    wallet.balance = balanceAfter;
    await wallet.save();

    const transaction = await Transaction.create({
      wallet: wallet._id,
      type: 'credit',
      amount,
      category: 'promo_credit',
      description: `Promo credit from ${promoCode}`,
      status: 'completed',
      balanceBefore,
      balanceAfter,
      metadata: { promoCode }
    });

    return transaction;
  }

  /**
   * Get transaction history
   * @param {String} userId - User ID
   * @param {Object} options - Query options
   * @returns {Array} Transactions
   */
  async getTransactions(userId, options = {}) {
    const wallet = await this.getOrCreateWallet(userId);
    
    const { 
      limit = 50, 
      skip = 0, 
      category = null,
      startDate = null,
      endDate = null
    } = options;

    const query = { wallet: wallet._id };
    
    if (category) {
      query.category = category;
    }
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .populate('booking');

    return transactions;
  }

  /**
   * Get wallet summary
   * @param {String} userId - User ID
   * @returns {Object} Summary
   */
  async getSummary(userId) {
    const wallet = await this.getOrCreateWallet(userId);
    
    // Get transaction statistics
    const stats = await Transaction.aggregate([
      { $match: { wallet: wallet._id } },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    const summary = {
      balance: wallet.balance,
      currency: wallet.currency,
      totalCredits: 0,
      totalDebits: 0,
      transactionCount: 0
    };

    stats.forEach(stat => {
      if (stat._id === 'credit') {
        summary.totalCredits = stat.total;
      } else if (stat._id === 'debit') {
        summary.totalDebits = stat.total;
      }
      summary.transactionCount += stat.count;
    });

    return summary;
  }

  /**
   * Check if user has sufficient balance
   * @param {String} userId - User ID
   * @param {Number} amount - Amount to check
   * @returns {Boolean}
   */
  async hasSufficientBalance(userId, amount) {
    const balance = await this.getBalance(userId);
    return balance >= amount;
  }
}

module.exports = new WalletService();
