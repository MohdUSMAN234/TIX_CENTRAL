/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import { 
  User, Venue, EventListing, SeatState, Booking, 
  WaitlistEntry, EmailLog, SeatCategory, SeatConfig 
} from '../src/types.js';

const DB_FILE = path.join(process.cwd(), 'db.json');

// Simple Mutex for transaction isolation and concurrency safety
class Mutex {
  private queue: (() => void)[] = [];
  private locked = false;

  async acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      const release = () => {
        if (this.queue.length > 0) {
          const next = this.queue.shift();
          next?.();
        } else {
          this.locked = false;
        }
      };

      if (!this.locked) {
        this.locked = true;
        resolve(release);
      } else {
        this.queue.push(() => resolve(release));
      }
    });
  }
}

interface DBState {
  users: any[];
  venues: Venue[];
  events: EventListing[];
  seats: SeatState[];
  bookings: Booking[];
  waitlist: WaitlistEntry[];
  emails: EmailLog[];
}

export class JSONDatabase {
  private state: DBState = {
    users: [],
    venues: [],
    events: [],
    seats: [],
    bookings: [],
    waitlist: [],
    emails: []
  };
  private mutex = new Mutex();

  constructor() {
    this.load();
    // Seed initial data if database is empty
    if (this.state.users.length === 0) {
      this.seed();
    }
    // Start TTL check loop every 4 seconds
    setInterval(() => {
      this.cleanupExpiredHoldsAndOffers();
    }, 4000);
  }

  private load() {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.state = JSON.parse(raw);
        // Correct dates back to ISO strings
      }
    } catch (e) {
      console.error('Error loading database, initializing empty state:', e);
    }
  }

  private save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.state, null, 2), 'utf-8');
    } catch (e) {
      console.error('Error saving database:', e);
    }
  }

  private seed() {
    console.log('Seeding initial data...');
    
    // Seed Users with distinct roles
    this.state.users = [
      { id: 'u1', name: 'Albin Keller', email: 'admin@booking.com', password: 'password123', role: 'admin' },
      { id: 'u2', name: 'Sophie Dupont', email: 'organiser@booking.com', password: 'password123', role: 'organiser' },
      { id: 'u3', name: 'Milo Vance', email: 'customer@booking.com', password: 'password123', role: 'customer' },
      { id: 'u4', name: 'Zara Lin', email: 'zara@booking.com', password: 'password123', role: 'customer' }
    ];

    // Seed Venues
    const venue1: Venue = {
      id: 'v1',
      name: 'Starlight Theater (Acoustic Hall)',
      rows: 6,
      cols: 8,
      layout: []
    };
    // Populate layout
    for (let r = 1; r <= 6; r++) {
      for (let c = 1; c <= 8; c++) {
        let category: SeatCategory = 'Standard';
        if (r <= 2) category = 'VIP';
        else if (r <= 4) category = 'Premium';
        venue1.layout.push({ row: r, col: c, category });
      }
    }

    const venue2: Venue = {
      id: 'v2',
      name: 'Metro Arena (Main Stage)',
      rows: 5,
      cols: 6,
      layout: []
    };
    for (let r = 1; r <= 5; r++) {
      for (let c = 1; c <= 6; c++) {
        let category: SeatCategory = 'Standard';
        if (r === 1) category = 'VIP';
        else if (r <= 3) category = 'Premium';
        venue2.layout.push({ row: r, col: c, category });
      }
    }

    this.state.venues = [venue1, venue2];

    // Seed Event Listings
    const event1: EventListing = {
      id: 'e1',
      title: 'Neon Odyssey: Synthwave LIVE',
      description: 'An immersive retro-futuristic synthesizer concert featuring custom audio-visual installations and deep bass waves.',
      date: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0], // 3 days in future
      time: '20:00',
      venueId: 'v1',
      venueName: venue1.name,
      pricing: { Standard: 45, Premium: 75, VIP: 120 },
      organiserId: 'u2'
    };

    const event2: EventListing = {
      id: 'e2',
      title: 'Cinematheque: Interstellar Retrospective',
      description: 'Experience Hans Zimmer\'s epic theatrical masterpiece on the giant screen with live high-fidelity audio remastering.',
      date: new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0], // 5 days in future
      time: '18:30',
      venueId: 'v2',
      venueName: venue2.name,
      pricing: { Standard: 20, Premium: 35, VIP: 55 },
      organiserId: 'u2'
    };

    this.state.events = [event1, event2];

    // Initialize Seat States for seeded events
    this.initializeEventSeats(event1, venue1);
    this.initializeEventSeats(event2, venue2);

    // Pre-book a few seats on event 2 to show interactive maps
    this.bookSeededSeat('e2', 1, 3, 'admin@booking.com');
    this.bookSeededSeat('e2', 1, 4, 'admin@booking.com');
    this.bookSeededSeat('e2', 4, 3, 'customer@booking.com');

    this.save();
  }

  private initializeEventSeats(event: EventListing, venue: Venue) {
    venue.layout.forEach(seatConf => {
      this.state.seats.push({
        id: `${event.id}:${seatConf.row}:${seatConf.col}`,
        showId: event.id,
        row: seatConf.row,
        col: seatConf.col,
        category: seatConf.category,
        status: 'available'
      });
    });
  }

  private bookSeededSeat(showId: string, row: number, col: number, email: string) {
    const seat = this.state.seats.find(s => s.showId === showId && s.row === row && s.col === col);
    if (seat) {
      seat.status = 'booked';
      seat.bookedByEmail = email;
      seat.bookingId = 'b_seed_' + Math.random().toString(36).substr(2, 6);
    }
  }

  // --- PUBLIC DB API WITH MUTEX ISOLATION ---

  async getUsers(): Promise<any[]> {
    return this.state.users;
  }

  async addUser(user: any): Promise<void> {
    const release = await this.mutex.acquire();
    try {
      this.state.users.push(user);
      this.save();
    } finally {
      release();
    }
  }

  async getVenues(): Promise<Venue[]> {
    return this.state.venues;
  }

  async addVenue(venue: Venue): Promise<void> {
    const release = await this.mutex.acquire();
    try {
      this.state.venues.push(venue);
      this.save();
    } finally {
      release();
    }
  }

  async updateVenue(venueId: string, venue: Partial<Venue>): Promise<void> {
    const release = await this.mutex.acquire();
    try {
      const idx = this.state.venues.findIndex(v => v.id === venueId);
      if (idx !== -1) {
        this.state.venues[idx] = { ...this.state.venues[idx], ...venue };
        this.save();
      }
    } finally {
      release();
    }
  }

  async getEvents(): Promise<EventListing[]> {
    return this.state.events;
  }

  async addEvent(event: EventListing): Promise<void> {
    const release = await this.mutex.acquire();
    try {
      this.state.events.push(event);
      // Initialize seats for this event using venue layout
      const venue = this.state.venues.find(v => v.id === event.venueId);
      if (venue) {
        this.initializeEventSeats(event, venue);
      }
      this.save();
    } finally {
      release();
    }
  }

  async getSeats(showId: string): Promise<SeatState[]> {
    return this.state.seats.filter(s => s.showId === showId);
  }

  async getBookings(): Promise<Booking[]> {
    return this.state.bookings;
  }

  async getWaitlist(showId?: string): Promise<WaitlistEntry[]> {
    if (showId) {
      return this.state.waitlist.filter(w => w.showId === showId);
    }
    return this.state.waitlist;
  }

  async getEmails(): Promise<EmailLog[]> {
    return this.state.emails;
  }

  // Clear all email logs
  async clearEmails(): Promise<void> {
    const release = await this.mutex.acquire();
    try {
      this.state.emails = [];
      this.save();
    } finally {
      release();
    }
  }

  // Concurrency Guarded: Hold Seats (with TTL)
  async holdSeats(
    showId: string, 
    seatsToHold: { row: number; col: number }[], 
    sessionOrEmail: string, 
    userName: string,
    ttlSeconds = 600 // default 10 minutes
  ): Promise<{ success: boolean; message: string; heldUntil?: string }> {
    const release = await this.mutex.acquire();
    try {
      const showSeats = this.state.seats.filter(s => s.showId === showId);
      const targetSeats: SeatState[] = [];

      // Verify all requested seats are available
      for (const req of seatsToHold) {
        const seat = showSeats.find(s => s.row === req.row && s.col === req.col);
        if (!seat) {
          return { success: false, message: `Seat R${req.row}C${req.col} does not exist.` };
        }
        if (seat.status !== 'available') {
          return { success: false, message: `Seat R${req.row}C${req.col} is no longer available.` };
        }
        targetSeats.push(seat);
      }

      // Safe! Let's lock them in.
      const heldUntil = new Date(Date.now() + ttlSeconds * 1000).toISOString();
      targetSeats.forEach(seat => {
        seat.status = 'held';
        seat.heldBySessionId = sessionOrEmail;
        seat.heldByUserEmail = sessionOrEmail;
        seat.heldUntil = heldUntil;
      });

      this.save();
      return { 
        success: true, 
        message: `Successfully held ${seatsToHold.length} seat(s).`,
        heldUntil 
      };
    } finally {
      release();
    }
  }

  // Concurrency Guarded: Release Held Seats for a session
  async releaseHeldSeats(showId: string, sessionOrEmail: string): Promise<void> {
    const release = await this.mutex.acquire();
    try {
      const heldSeats = this.state.seats.filter(
        s => s.showId === showId && s.status === 'held' && s.heldBySessionId === sessionOrEmail
      );
      
      heldSeats.forEach(seat => {
        seat.status = 'available';
        delete seat.heldBySessionId;
        delete seat.heldByUserEmail;
        delete seat.heldUntil;
      });

      if (heldSeats.length > 0) {
        this.save();
        // Since seats became available, evaluate waitlists
        this.processWaitlistForEvent(showId);
      }
    } finally {
      release();
    }
  }

  // Concurrency Guarded: Book Seats (either directly or confirming a hold)
  async confirmBooking(
    showId: string,
    seatsToBook: { row: number; col: number }[],
    customerName: string,
    customerEmail: string,
    sessionOrEmail?: string // optional hold token
  ): Promise<{ success: boolean; message: string; booking?: Booking }> {
    const release = await this.mutex.acquire();
    try {
      const showSeats = this.state.seats.filter(s => s.showId === showId);
      const event = this.state.events.find(e => e.id === showId);
      if (!event) {
        return { success: false, message: 'Event not found.' };
      }

      const targetSeats: SeatState[] = [];

      // Verify seats are either available or held by this session
      for (const req of seatsToBook) {
        const seat = showSeats.find(s => s.row === req.row && s.col === req.col);
        if (!seat) {
          return { success: false, message: `Seat R${req.row}C${req.col} does not exist.` };
        }

        const isHeldByMe = seat.status === 'held' && 
          (sessionOrEmail && (seat.heldBySessionId === sessionOrEmail || seat.heldByUserEmail === sessionOrEmail));
        
        if (seat.status !== 'available' && !isHeldByMe) {
          return { success: false, message: `Seat R${req.row}C${req.col} is not available for booking.` };
        }
        targetSeats.push(seat);
      }

      // Generate Booking
      const bookingId = 'BK-' + Math.random().toString(36).substr(2, 8).toUpperCase();
      let totalPrice = 0;
      const bookedSeatsSummary = targetSeats.map(seat => {
        const price = event.pricing[seat.category] || event.pricing.Standard;
        totalPrice += price;
        return {
          row: seat.row,
          col: seat.col,
          category: seat.category,
          price
        };
      });

      // Update seats to booked
      targetSeats.forEach(seat => {
        seat.status = 'booked';
        seat.bookingId = bookingId;
        seat.bookedByEmail = customerEmail;
        delete seat.heldBySessionId;
        delete seat.heldByUserEmail;
        delete seat.heldUntil;
      });

      // Generate QR Code containing booking ID and details
      const qrData = JSON.stringify({
        bookingId,
        event: event.title,
        customer: customerName,
        seats: bookedSeatsSummary.map(s => `R${s.row}C${s.col}`).join(',')
      });
      const qrCodeDataUrl = await QRCode.toDataURL(qrData);

      const booking: Booking = {
        id: bookingId,
        showId,
        eventTitle: event.title,
        eventDate: event.date,
        eventTime: event.time,
        seats: bookedSeatsSummary,
        customerName,
        customerEmail,
        totalPrice,
        qrCode: qrCodeDataUrl,
        status: 'confirmed',
        createdAt: new Date().toISOString()
      };

      this.state.bookings.push(booking);
      
      // If booking was an accepted waitlist offer, clear waitlist entry
      this.state.waitlist = this.state.waitlist.filter(
        w => !(w.showId === showId && w.customerEmail === customerEmail && w.offeredSeat)
      );

      this.save();

      // Trigger Email dispatch simulation
      await this.logAndDispatchEmail({
        id: 'em-' + Math.random().toString(36).substr(2, 6),
        to: customerEmail,
        subject: `🎟️ Your Tickets Confirmed: ${event.title}`,
        body: `Dear ${customerName},\n\nYour booking for ${event.title} is CONFIRMED.\n` +
              `Booking Reference: ${bookingId}\n` +
              `Date: ${event.date} at ${event.time}\n` +
              `Seats: ${bookedSeatsSummary.map(s => `Row ${s.row} Col ${s.col} (${s.category} - $${s.price})`).join(', ')}\n` +
              `Total Paid: $${totalPrice.toFixed(2)}\n\n` +
              `Show the attached QR Code at the entrance. Enjoy your event!`,
        qrCode: qrCodeDataUrl,
        timestamp: new Date().toISOString()
      });

      return { success: true, message: 'Booking confirmed successfully!', booking };
    } catch (err: any) {
      console.error(err);
      return { success: false, message: 'Booking confirmation failed: ' + err.message };
    } finally {
      release();
    }
  }

  // Cancel Booking
  async cancelBooking(bookingId: string): Promise<{ success: boolean; message: string }> {
    const release = await this.mutex.acquire();
    try {
      const booking = this.state.bookings.find(b => b.id === bookingId);
      if (!booking) {
        return { success: false, message: 'Booking not found.' };
      }
      if (booking.status === 'cancelled') {
        return { success: false, message: 'Booking is already cancelled.' };
      }

      booking.status = 'cancelled';

      // Release seats back to available
      const bookingSeats = this.state.seats.filter(s => s.bookingId === bookingId);
      bookingSeats.forEach(seat => {
        seat.status = 'available';
        delete seat.bookingId;
        delete seat.bookedByEmail;
      });

      this.save();

      // Trigger email cancellation
      await this.logAndDispatchEmail({
        id: 'em-' + Math.random().toString(36).substr(2, 6),
        to: booking.customerEmail,
        subject: `⚠️ Booking Cancellation: ${booking.eventTitle}`,
        body: `Dear ${booking.customerName},\n\nYour booking ${bookingId} for ${booking.eventTitle} has been successfully cancelled.\n` +
              `A refund of $${booking.totalPrice.toFixed(2)} has been initiated.\n\nThank you for using our service.`,
        timestamp: new Date().toISOString()
      });

      // IMPORTANT: Since seats became available, process waitlist queues!
      this.processWaitlistForEvent(booking.showId);

      return { success: true, message: 'Booking successfully cancelled.' };
    } finally {
      release();
    }
  }

  // Join Waitlist
  async joinWaitlist(
    showId: string, 
    customerName: string, 
    customerEmail: string, 
    category: SeatCategory
  ): Promise<{ success: boolean; message: string }> {
    const release = await this.mutex.acquire();
    try {
      // Check if already waitlisted for this category
      const alreadyWaitlisted = this.state.waitlist.some(
        w => w.showId === showId && w.customerEmail === customerEmail && w.category === category
      );
      if (alreadyWaitlisted) {
        return { success: false, message: 'You are already on the waitlist for this category.' };
      }

      const event = this.state.events.find(e => e.id === showId);
      if (!event) return { success: false, message: 'Event not found.' };

      const entry: WaitlistEntry = {
        id: 'wl-' + Math.random().toString(36).substr(2, 8).toUpperCase(),
        showId,
        eventTitle: event.title,
        customerName,
        customerEmail,
        category,
        createdAt: new Date().toISOString()
      };

      this.state.waitlist.push(entry);
      this.save();

      // Dispatch confirmation email
      await this.logAndDispatchEmail({
        id: 'em-' + Math.random().toString(36).substr(2, 6),
        to: customerEmail,
        subject: `🕒 Waitlist Confirmed: ${event.title}`,
        body: `Dear ${customerName},\n\nYou have joined the waitlist for category [${category}] at the event "${event.title}".\n` +
              `We will automatically notify you with a booking offer as soon as a seat opens up. Offers remain valid for 2 minutes.\n\n` +
              `Thank you for your patience!`,
        timestamp: new Date().toISOString()
      });

      return { success: true, message: 'Successfully added to waitlist queue.' };
    } finally {
      release();
    }
  }

  // Email simulator logger
  private async logAndDispatchEmail(email: EmailLog) {
    this.state.emails.unshift(email);
    // Prune logs if they exceed 50 items
    if (this.state.emails.length > 50) {
      this.state.emails.pop();
    }
    this.save();
    console.log(`[EMAIL DISPATCH] To: ${email.to} | Subj: ${email.subject}`);
  }

  // --- WAITLIST AND TTL PROCESSOR (MUTEX-GUARDED CHRONO CYCLE) ---

  private async cleanupExpiredHoldsAndOffers() {
    const release = await this.mutex.acquire();
    try {
      const now = new Date();
      let dbModified = false;
      const affectedEvents = new Set<string>();

      // 1. Clean up expired seat holds
      this.state.seats.forEach(seat => {
        if (seat.status === 'held' && seat.heldUntil) {
          const expires = new Date(seat.heldUntil);
          if (now > expires) {
            console.log(`[TTL Auto-Release] Seat ${seat.id} held by ${seat.heldByUserEmail} has expired.`);
            seat.status = 'available';
            delete seat.heldBySessionId;
            delete seat.heldByUserEmail;
            delete seat.heldUntil;
            dbModified = true;
            affectedEvents.add(seat.showId);
          }
        }
      });

      // 2. Clean up expired waitlist offers
      this.state.waitlist.forEach(entry => {
        if (entry.offerExpiresAt) {
          const expires = new Date(entry.offerExpiresAt);
          if (now > expires && entry.offeredSeat) {
            console.log(`[Waitlist Offer Expired] Offer for ${entry.customerEmail} on seat R${entry.offeredSeat.row}C${entry.offeredSeat.col} expired.`);
            
            // Release the seat back to available
            const seat = this.state.seats.find(
              s => s.showId === entry.showId && s.row === entry.offeredSeat?.row && s.col === entry.offeredSeat?.col
            );
            if (seat) {
              seat.status = 'available';
              delete seat.heldBySessionId;
              delete seat.heldByUserEmail;
              delete seat.heldUntil;
            }

            // Remove offered properties but keep entry or re-queue it at end? 
            // In the spec: "If waitlisted customer does not complete, seat is offered to the next in line." 
            // So we remove this waitlisted user from the waitlist entirely or remove offer status.
            // Let's remove them and notify them.
            entry.offerSentAt = undefined;
            entry.offerExpiresAt = undefined;
            entry.offeredSeat = undefined;

            dbModified = true;
            affectedEvents.add(entry.showId);
          }
        }
      });

      // Filter out waitlist entries that completely expired so they don't block
      const expiredEntries = this.state.waitlist.filter(w => !w.offerExpiresAt && w.offeredSeat);
      // Clean up completely expired offers from the waitlist
      this.state.waitlist = this.state.waitlist.filter(w => {
        if (w.offeredSeat && !w.offerSentAt) {
          // completely abandoned
          return false;
        }
        return true;
      });

      if (dbModified) {
        this.save();
        // Since seats became available, process waitlist queues for those events
        affectedEvents.forEach(showId => {
          this.processWaitlistForEventLocked(showId);
        });
      }
    } finally {
      release();
    }
  }

  // Internal routine to process waitlist (under mutex already)
  private processWaitlistForEventLocked(showId: string) {
    const waitlist = this.state.waitlist.filter(w => w.showId === showId && !w.offeredSeat);
    if (waitlist.length === 0) return;

    const availableSeats = this.state.seats.filter(s => s.showId === showId && s.status === 'available');
    if (availableSeats.length === 0) return;

    // For each available seat, find the oldest waitlist entry for its category
    availableSeats.forEach(seat => {
      const matchingEntryIdx = this.state.waitlist.findIndex(
        w => w.showId === showId && w.category === seat.category && !w.offeredSeat
      );

      if (matchingEntryIdx !== -1) {
        const entry = this.state.waitlist[matchingEntryIdx];
        
        // Lock this seat for the waitlisted customer
        seat.status = 'held';
        // Treat customer's email as temporary hold session
        seat.heldBySessionId = entry.customerEmail;
        seat.heldByUserEmail = entry.customerEmail;
        // 2-minute deadline to book
        const heldUntil = new Date(Date.now() + 120 * 1000).toISOString();
        seat.heldUntil = heldUntil;

        // Update waitlist entry with offer details
        entry.offerSentAt = new Date().toISOString();
        entry.offerExpiresAt = heldUntil;
        entry.offeredSeat = { row: seat.row, col: seat.col };

        console.log(`[Waitlist Offer Auto-Assign] Offering seat R${seat.row}C${seat.col} to waitlisted user ${entry.customerEmail}`);
        
        // Dispatch booking notification
        this.logAndDispatchEmail({
          id: 'em-' + Math.random().toString(36).substr(2, 6),
          to: entry.customerEmail,
          subject: `✨ SPECIAL OFFER: Seat Available for ${entry.eventTitle}`,
          body: `Dear ${entry.customerName},\n\nGreat news! A seat in category [${entry.category}] has opened up.\n` +
                `We have reserved Seat: Row ${seat.row}, Col ${seat.col} exclusively for you.\n\n` +
                `This offer expires in exactly 2 MINUTES at ${new Date(heldUntil).toLocaleTimeString()}.\n` +
                `Click the link below to claim this seat and complete your booking:\n` +
                `👉 ${process.env.APP_URL || 'http://localhost:3000'}/?claimOffer=${entry.id}\n\n` +
                `If you do not complete the booking in time, this seat will automatically be offered to the next person on the waitlist.`,
          timestamp: new Date().toISOString()
        });
      }
    });

    this.save();
  }

  // Public entry to trigger waitlist evaluation safely outside locks
  private async processWaitlistForEvent(showId: string) {
    const release = await this.mutex.acquire();
    try {
      this.processWaitlistForEventLocked(showId);
    } finally {
      release();
    }
  }
}
