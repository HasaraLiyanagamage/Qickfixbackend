const PromoCode = require('../models/PromoCode');

class PricingService {
  constructor() {
    // Base fares for different service types (in LKR)
    this.baseFares = {
      plumbing: 500,
      electrical: 600,
      carpentry: 700,
      painting: 800,
      cleaning: 400,
      appliance_repair: 650,
      hvac: 750,
      locksmith: 550,
      default: 500
    };
    
    // Distance rate per kilometer
    this.distanceRate = 50; // LKR per km
    
    // Surge pricing configuration
    this.surgePricing = {
      enabled: true,
      peakHours: [8, 9, 10, 17, 18, 19, 20], // 8-10 AM, 5-8 PM
      weekendMultiplier: 1.3,
      peakHourMultiplier: 1.5,
      emergencyMultiplier: 2.0
    };
    
    // Urgency charges
    this.urgencyCharges = {
      normal: 0,
      urgent: 0.2, // 20% of base fare
      emergency: 0.5 // 50% of base fare
    };
  }

  /**
   * Calculate fare for a booking
   * @param {Object} params - Calculation parameters
   * @returns {Object} Fare breakdown
   */
  calculateFare(params) {
    const { 
      serviceType, 
      distance, 
      urgency = 'normal', 
      dateTime = new Date(),
      isWeekend = false 
    } = params;
    
    // 1. Base fare
    const baseFare = this.baseFares[serviceType] || this.baseFares.default;
    
    // 2. Distance fare
    const distanceFare = Math.round(distance * this.distanceRate);
    
    // 3. Service fare (urgency charge)
    const urgencyMultiplier = this.urgencyCharges[urgency] || 0;
    const serviceFare = Math.round(baseFare * urgencyMultiplier);
    
    // 4. Surge pricing
    let surgeFare = 0;
    let surgeReason = null;
    
    if (this.surgePricing.enabled) {
      const hour = new Date(dateTime).getHours();
      const isPeakHour = this.surgePricing.peakHours.includes(hour);
      
      if (urgency === 'emergency') {
        const surgeBase = baseFare + distanceFare;
        surgeFare = Math.round(surgeBase * (this.surgePricing.emergencyMultiplier - 1));
        surgeReason = 'Emergency service surge';
      } else if (isWeekend) {
        const surgeBase = baseFare + distanceFare;
        surgeFare = Math.round(surgeBase * (this.surgePricing.weekendMultiplier - 1));
        surgeReason = 'Weekend surge';
      } else if (isPeakHour) {
        const surgeBase = baseFare + distanceFare;
        surgeFare = Math.round(surgeBase * (this.surgePricing.peakHourMultiplier - 1));
        surgeReason = 'Peak hour surge';
      }
    }
    
    // 5. Calculate subtotal
    const subtotal = baseFare + distanceFare + serviceFare + surgeFare;
    
    return {
      baseFare,
      distanceFare,
      serviceFare,
      surgeFare,
      discount: 0,
      promoCode: null,
      subtotal,
      totalFare: subtotal,
      currency: 'LKR',
      breakdown: {
        base: `Base fare for ${serviceType}`,
        distance: `${distance.toFixed(2)} km × LKR ${this.distanceRate}/km`,
        service: urgency !== 'normal' ? `${urgency.charAt(0).toUpperCase() + urgency.slice(1)} service charge` : null,
        surge: surgeReason,
        discount: null
      }
    };
  }

  /**
   * Apply promo code to fare
   * @param {Object} fareDetails - Current fare details
   * @param {String} promoCode - Promo code to apply
   * @param {String} userId - User ID
   * @param {String} serviceType - Service type
   * @returns {Object} Updated fare details
   */
  async applyPromoCode(fareDetails, promoCode, userId, serviceType) {
    // Find and validate promo code
    const promo = await PromoCode.findOne({ 
      code: promoCode.toUpperCase(),
      isActive: true,
      validFrom: { $lte: new Date() },
      validUntil: { $gte: new Date() }
    });

    if (!promo) {
      throw new Error('Invalid or expired promo code');
    }

    // Check if promo applies to this service type
    if (promo.applicableServices.length > 0 && 
        !promo.applicableServices.includes(serviceType)) {
      throw new Error('Promo code not applicable to this service');
    }

    // Check minimum booking amount
    if (fareDetails.subtotal < promo.minBookingAmount) {
      throw new Error(`Minimum booking amount of LKR ${promo.minBookingAmount} required`);
    }

    // Check total usage limit
    if (promo.usageLimit.total && promo.usedCount >= promo.usageLimit.total) {
      throw new Error('Promo code usage limit reached');
    }

    // TODO: Check per-user usage limit (requires user usage tracking)

    // Calculate discount
    let discount = 0;
    if (promo.type === 'percentage') {
      discount = Math.round((fareDetails.subtotal * promo.value) / 100);
      if (promo.maxDiscount && discount > promo.maxDiscount) {
        discount = promo.maxDiscount;
      }
    } else if (promo.type === 'fixed') {
      discount = promo.value;
    }

    // Ensure discount doesn't exceed subtotal
    if (discount > fareDetails.subtotal) {
      discount = fareDetails.subtotal;
    }

    return {
      ...fareDetails,
      discount,
      promoCode: promo.code,
      totalFare: fareDetails.subtotal - discount,
      breakdown: {
        ...fareDetails.breakdown,
        discount: `Promo code ${promo.code} (${promo.type === 'percentage' ? promo.value + '%' : 'LKR ' + promo.value})`
      }
    };
  }

  /**
   * Check if current time is surge time
   * @param {Date} dateTime - Date/time to check
   * @returns {Boolean}
   */
  isSurgeTime(dateTime = new Date()) {
    if (!this.surgePricing.enabled) return false;
    const hour = dateTime.getHours();
    return this.surgePricing.peakHours.includes(hour);
  }

  /**
   * Get surge multiplier for current time
   * @param {Date} dateTime - Date/time to check
   * @param {String} urgency - Urgency level
   * @returns {Number}
   */
  getSurgeMultiplier(dateTime = new Date(), urgency = 'normal') {
    if (!this.surgePricing.enabled) return 1.0;
    
    if (urgency === 'emergency') {
      return this.surgePricing.emergencyMultiplier;
    }
    
    const day = dateTime.getDay();
    const isWeekend = day === 0 || day === 6;
    
    if (isWeekend) {
      return this.surgePricing.weekendMultiplier;
    }
    
    const hour = dateTime.getHours();
    if (this.surgePricing.peakHours.includes(hour)) {
      return this.surgePricing.peakHourMultiplier;
    }
    
    return 1.0;
  }

  /**
   * Update pricing configuration (admin only)
   * @param {Object} config - New configuration
   */
  updateConfig(config) {
    if (config.baseFares) {
      this.baseFares = { ...this.baseFares, ...config.baseFares };
    }
    if (config.distanceRate !== undefined) {
      this.distanceRate = config.distanceRate;
    }
    if (config.surgePricing) {
      this.surgePricing = { ...this.surgePricing, ...config.surgePricing };
    }
    if (config.urgencyCharges) {
      this.urgencyCharges = { ...this.urgencyCharges, ...config.urgencyCharges };
    }
  }

  /**
   * Get current pricing configuration
   * @returns {Object}
   */
  getConfig() {
    return {
      baseFares: this.baseFares,
      distanceRate: this.distanceRate,
      surgePricing: this.surgePricing,
      urgencyCharges: this.urgencyCharges
    };
  }
}

// Export singleton instance
module.exports = new PricingService();
