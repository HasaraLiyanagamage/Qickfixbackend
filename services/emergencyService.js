/**
 * Emergency Priority Service
 * Handles emergency bookings with priority matching and auto-escalation
 */

const Booking = require('../models/Booking');
const Technician = require('../models/Technician');

// Priority configuration
const PRIORITY_CONFIG = {
  emergency: {
    level: 2,
    timeout: 2, // minutes
    broadcastCount: 5, // notify 5 technicians simultaneously
    surgeMultiplier: 2.0,
    maxRadius: 20 // km
  },
  urgent: {
    level: 1,
    timeout: 5,
    broadcastCount: 3,
    surgeMultiplier: 1.5,
    maxRadius: 15
  },
  normal: {
    level: 0,
    timeout: 10,
    broadcastCount: 1,
    surgeMultiplier: 1.0,
    maxRadius: 10
  }
};

class EmergencyService {
  /**
   * Create emergency booking with priority handling
   */
  static async createEmergencyBooking(bookingData) {
    const { urgency = 'normal' } = bookingData;
    const config = PRIORITY_CONFIG[urgency];
    
    // Set emergency fields
    const emergencyData = {
      isEmergency: urgency === 'emergency',
      priority: config.level,
      responseTimeout: config.timeout,
      autoEscalate: true
    };
    
    // Create booking with emergency data
    const booking = await Booking.create({
      ...bookingData,
      emergency: emergencyData
    });
    
    // Immediately start matching process
    await this.matchTechnicians(booking._id);
    
    // Set up auto-escalation if no response
    if (emergencyData.autoEscalate) {
      this.scheduleEscalation(booking._id, config.timeout);
    }
    
    return booking;
  }
  
  /**
   * Match technicians based on priority
   */
  static async matchTechnicians(bookingId) {
    const booking = await Booking.findById(bookingId).populate('user');
    if (!booking) throw new Error('Booking not found');
    
    const config = PRIORITY_CONFIG[booking.urgency];
    const { lat, lng } = booking.location;
    
    // Find available technicians near the location
    // For emergency service type, find ALL available technicians
    // For specific services, filter by skill
    const query = {
      isAvailable: true,
      'location.coordinates': { $exists: true }
    };
    
    // Only filter by skill if NOT emergency service
    if (booking.serviceType && booking.serviceType.toLowerCase() !== 'emergency') {
      query.skills = booking.serviceType;
    }
    
    const technicians = await Technician.find(query);
    
    // Calculate distances and sort by proximity
    const techniciansWithDistance = technicians
      .map(tech => {
        // Technician location is stored as GeoJSON: { type: 'Point', coordinates: [lng, lat] }
        if (!tech.location || !tech.location.coordinates || tech.location.coordinates.length < 2) {
          return null; // Skip technicians without valid location
        }
        
        const techLng = tech.location.coordinates[0];
        const techLat = tech.location.coordinates[1];
        
        const distance = this.calculateDistance(
          lat, lng,
          techLat, techLng
        );
        return { technician: tech, distance };
      })
      .filter(t => t !== null && t.distance <= config.maxRadius)
      .sort((a, b) => a.distance - b.distance);
    
    // Broadcast to multiple technicians based on priority
    const techsToNotify = techniciansWithDistance.slice(0, config.broadcastCount);
    
    if (techsToNotify.length === 0) {
      // No technicians available - escalate immediately
      await this.escalateBooking(bookingId);
      return { matched: false, escalated: true };
    }
    
    // Update booking with broadcast info
    await Booking.findByIdAndUpdate(bookingId, {
      'emergency.broadcastCount': techsToNotify.length,
      'emergency.broadcastedTo': techsToNotify.map(t => t.technician._id),
      status: 'matched'
    });
    
    // Send notifications to all selected technicians
    const io = require('../server').io;
    if (io) {
      techsToNotify.forEach(({ technician, distance }) => {
        io.to(`technician_${technician._id}`).emit('emergency:booking', {
          bookingId: booking._id,
          urgency: booking.urgency,
          serviceType: booking.serviceType,
          location: booking.location,
          distance: distance.toFixed(2),
          priority: booking.emergency.priority,
          timeout: config.timeout,
          surgeMultiplier: config.surgeMultiplier
        });
      });
    }
    
    return {
      matched: true,
      techniciansNotified: techsToNotify.length,
      distances: techsToNotify.map(t => t.distance)
    };
  }
  
  /**
   * Schedule auto-escalation if no response
   */
  static scheduleEscalation(bookingId, timeoutMinutes) {
    setTimeout(async () => {
      const booking = await Booking.findById(bookingId);
      
      // Check if booking is still in matched/requested status
      if (booking && ['requested', 'matched'].includes(booking.status)) {
        console.log(`Auto-escalating booking ${bookingId} - no response within ${timeoutMinutes} minutes`);
        await this.escalateBooking(bookingId);
      }
    }, timeoutMinutes * 60 * 1000); // Convert to milliseconds
  }
  
  /**
   * Escalate booking to wider radius and more technicians
   */
  static async escalateBooking(bookingId) {
    const booking = await Booking.findById(bookingId);
    if (!booking) return;
    
    const currentLevel = booking.emergency.escalationLevel;
    const newLevel = currentLevel + 1;
    
    // Update escalation level
    await Booking.findByIdAndUpdate(bookingId, {
      'emergency.escalationLevel': newLevel,
      'emergency.escalatedAt': new Date()
    });
    
    // Increase search radius and broadcast count
    const expandedRadius = PRIORITY_CONFIG[booking.urgency].maxRadius * (1 + newLevel * 0.5);
    const expandedBroadcast = PRIORITY_CONFIG[booking.urgency].broadcastCount * (1 + newLevel);
    
    console.log(`Escalation level ${newLevel}: Radius=${expandedRadius}km, Broadcast=${expandedBroadcast}`);
    
    // Find more technicians with expanded criteria
    const query = {
      isAvailable: true,
      'location.coordinates': { $exists: true }
    };
    
    // Only filter by skill if NOT emergency service
    if (booking.serviceType && booking.serviceType.toLowerCase() !== 'emergency') {
      query.skills = booking.serviceType;
    }
    
    const technicians = await Technician.find(query);
    
    const { lat, lng } = booking.location;
    const techniciansWithDistance = technicians
      .map(tech => {
        if (!tech.location || !tech.location.coordinates || tech.location.coordinates.length < 2) {
          return null;
        }
        const techLng = tech.location.coordinates[0];
        const techLat = tech.location.coordinates[1];
        return {
          technician: tech,
          distance: this.calculateDistance(lat, lng, techLat, techLng)
        };
      })
      .filter(t => t !== null)
      .filter(t => t.distance <= expandedRadius)
      .filter(t => !booking.emergency.broadcastedTo.includes(t.technician._id)) // Exclude already notified
      .sort((a, b) => a.distance - b.distance)
      .slice(0, expandedBroadcast);
    
    if (techniciansWithDistance.length > 0) {
      // Update booking
      await Booking.findByIdAndUpdate(bookingId, {
        $inc: { 'emergency.broadcastCount': techniciansWithDistance.length },
        $push: {
          'emergency.broadcastedTo': {
            $each: techniciansWithDistance.map(t => t.technician._id)
          }
        }
      });
      
      // Notify escalated technicians
      const io = require('../server').io;
      if (io) {
        techniciansWithDistance.forEach(({ technician, distance }) => {
          io.to(`technician_${technician._id}`).emit('emergency:escalated', {
            bookingId: booking._id,
            urgency: booking.urgency,
            escalationLevel: newLevel,
            serviceType: booking.serviceType,
            location: booking.location,
            distance: distance.toFixed(2),
            message: `ESCALATED: No response from nearby technicians. Urgent help needed!`
          });
        });
      }
      
      // Schedule next escalation if still no response
      if (newLevel < 3) { // Max 3 escalation levels
        this.scheduleEscalation(bookingId, 3); // 3 minutes for next escalation
      } else {
        // Max escalation reached - notify admin
        this.notifyAdmin(bookingId);
      }
    } else {
      // No more technicians available - notify admin immediately
      this.notifyAdmin(bookingId);
    }
  }
  
  /**
   * Notify admin when max escalation reached
   */
  static async notifyAdmin(bookingId) {
    const booking = await Booking.findById(bookingId).populate('user');
    
    console.log(`ADMIN ALERT: Booking ${bookingId} - No technicians available after max escalation`);
    
    const io = require('../server').io;
    if (io) {
      io.emit('admin:emergency:unmatched', {
        bookingId: booking._id,
        user: booking.user,
        serviceType: booking.serviceType,
        location: booking.location,
        urgency: booking.urgency,
        escalationLevel: booking.emergency.escalationLevel,
        message: 'CRITICAL: Emergency booking could not be matched with any technician'
      });
    }
  }
  
  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  static calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
  
  static toRad(degrees) {
    return degrees * (Math.PI / 180);
  }
  
  /**
   * Get emergency statistics
   */
  static async getEmergencyStats() {
    const now = new Date();
    const last24Hours = new Date(now - 24 * 60 * 60 * 1000);
    
    const stats = await Booking.aggregate([
      {
        $match: {
          'emergency.isEmergency': true,
          createdAt: { $gte: last24Hours }
        }
      },
      {
        $group: {
          _id: '$urgency',
          count: { $sum: 1 },
          avgResponseTime: { $avg: '$emergency.responseTimeout' },
          escalated: {
            $sum: { $cond: [{ $gt: ['$emergency.escalationLevel', 0] }, 1, 0] }
          }
        }
      }
    ]);
    
    return stats;
  }
}

module.exports = EmergencyService;
