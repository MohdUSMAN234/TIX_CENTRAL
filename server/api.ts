/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { JSONDatabase } from './db.js';
import { Venue, EventListing, SeatCategory } from '../src/types.js';

export const dbInstance = new JSONDatabase();
const router = express.Router();

// Helper to check permissions / role
const requireRole = (roles: string[]) => {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const userRole = req.headers['x-user-role'] as string;
    if (!userRole || !roles.includes(userRole)) {
      res.status(403).json({ error: 'Forbidden: Insufficient privileges.' });
      return;
    }
    next();
  };
};

// --- AUTH API ---

router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const users = await dbInstance.getUsers();
  const user = users.find(u => u.email === email && u.password === password);

  if (!user) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
});

router.post('/auth/register', async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !role) {
    res.status(400).json({ error: 'Missing registration details.' });
    return;
  }

  const users = await dbInstance.getUsers();
  if (users.some(u => u.email === email)) {
    res.status(400).json({ error: 'A user with this email already exists.' });
    return;
  }

  const newUser = {
    id: 'u_' + Math.random().toString(36).substr(2, 6),
    name,
    email,
    password,
    role
  };

  await dbInstance.addUser(newUser);
  res.status(201).json({ id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role });
});

// --- VENUES API ---

router.get('/venues', async (req, res) => {
  const venues = await dbInstance.getVenues();
  res.json(venues);
});

router.post('/venues', requireRole(['admin']), async (req, res) => {
  const { name, rows, cols, layout } = req.body;
  if (!name || !rows || !cols) {
    res.status(400).json({ error: 'Name, rows, and cols are required.' });
    return;
  }

  const venueId = 'v_' + Math.random().toString(36).substr(2, 6);
  const newVenue: Venue = {
    id: venueId,
    name,
    rows: Number(rows),
    cols: Number(cols),
    layout: layout || []
  };

  await dbInstance.addVenue(newVenue);
  res.status(201).json(newVenue);
});

// --- EVENTS API ---

router.get('/events', async (req, res) => {
  const events = await dbInstance.getEvents();
  res.json(events);
});

router.post('/events', requireRole(['organiser', 'admin']), async (req, res) => {
  const { title, description, date, time, venueId, pricing } = req.body;
  if (!title || !date || !time || !venueId || !pricing) {
    res.status(400).json({ error: 'Missing event details.' });
    return;
  }

  const venues = await dbInstance.getVenues();
  const venue = venues.find(v => v.id === venueId);
  if (!venue) {
    res.status(400).json({ error: 'Selected venue does not exist.' });
    return;
  }

  const eventId = 'e_' + Math.random().toString(36).substr(2, 6);
  const newEvent: EventListing = {
    id: eventId,
    title,
    description: description || '',
    date,
    time,
    venueId,
    venueName: venue.name,
    pricing: {
      Standard: Number(pricing.Standard || 0),
      Premium: Number(pricing.Premium || 0),
      VIP: Number(pricing.VIP || 0)
    },
    organiserId: (req.headers['x-user-id'] as string) || 'u2'
  };

  await dbInstance.addEvent(newEvent);
  res.status(201).json(newEvent);
});

// --- SEAT STATUS API ---

router.get('/events/:id/seats', async (req, res) => {
  const showId = req.params.id;
  const seats = await dbInstance.getSeats(showId);
  res.json(seats);
});

// Concurrency guarded seat hold TTL
router.post('/events/:id/hold', async (req, res) => {
  const showId = req.params.id;
  const { seats, email, name, ttlSeconds } = req.body;

  if (!seats || !Array.isArray(seats) || seats.length === 0 || !email) {
    res.status(400).json({ error: 'Must specify seat list and hold session email.' });
    return;
  }

  const result = await dbInstance.holdSeats(showId, seats, email, name || 'Customer', ttlSeconds);
  if (!result.success) {
    res.status(409).json({ error: result.message });
    return;
  }

  res.json(result);
});

// Release held seats
router.post('/events/:id/release', async (req, res) => {
  const showId = req.params.id;
  const { email } = req.body;

  if (!email) {
    res.status(400).json({ error: 'Must specify hold session email.' });
    return;
  }

  await dbInstance.releaseHeldSeats(showId, email);
  res.json({ success: true, message: 'Held seats released.' });
});

// Confirm Booking
router.post('/events/:id/book', async (req, res) => {
  const showId = req.params.id;
  const { seats, name, email, holdToken } = req.body;

  if (!seats || !Array.isArray(seats) || seats.length === 0 || !name || !email) {
    res.status(400).json({ error: 'Missing name, email, or seat selection.' });
    return;
  }

  const result = await dbInstance.confirmBooking(showId, seats, name, email, holdToken);
  if (!result.success) {
    res.status(409).json({ error: result.message });
    return;
  }

  res.json(result);
});

// --- BOOKINGS API ---

router.get('/bookings', async (req, res) => {
  const userEmail = req.headers['x-user-email'] as string;
  const userRole = req.headers['x-user-role'] as string;
  const bookings = await dbInstance.getBookings();

  if (userRole === 'admin') {
    res.json(bookings);
  } else if (userRole === 'organiser') {
    // Show bookings for events organized by this user
    const events = await dbInstance.getEvents();
    const myEvents = events.filter(e => e.organiserId === req.headers['x-user-id']);
    const myEventIds = myEvents.map(e => e.id);
    res.json(bookings.filter(b => myEventIds.includes(b.showId)));
  } else {
    // Customer sees their own
    res.json(bookings.filter(b => b.customerEmail === userEmail));
  }
});

router.post('/bookings/:id/cancel', async (req, res) => {
  const bookingId = req.params.id;
  const result = await dbInstance.cancelBooking(bookingId);
  if (!result.success) {
    res.status(400).json({ error: result.message });
    return;
  }
  res.json(result);
});

// --- WAITLIST API ---

router.post('/events/:id/waitlist', async (req, res) => {
  const showId = req.params.id;
  const { name, email, category } = req.body;

  if (!name || !email || !category) {
    res.status(400).json({ error: 'Name, email, and seat category are required.' });
    return;
  }

  const result = await dbInstance.joinWaitlist(showId, name, email, category as SeatCategory);
  if (!result.success) {
    res.status(400).json({ error: result.message });
    return;
  }

  res.json(result);
});

router.get('/waitlist', async (req, res) => {
  const userEmail = req.headers['x-user-email'] as string;
  const userRole = req.headers['x-user-role'] as string;
  const list = await dbInstance.getWaitlist();

  if (userRole === 'admin' || userRole === 'organiser') {
    res.json(list);
  } else {
    res.json(list.filter(w => w.customerEmail === userEmail));
  }
});

// Verify waitlist offer
router.get('/waitlist/offer/:id', async (req, res) => {
  const waitlistId = req.params.id;
  const list = await dbInstance.getWaitlist();
  const entry = list.find(w => w.id === waitlistId);

  if (!entry) {
    res.status(404).json({ error: 'Offer not found.' });
    return;
  }

  if (!entry.offeredSeat || !entry.offerExpiresAt) {
    res.status(400).json({ error: 'This waitlist entry does not have an active offer.' });
    return;
  }

  const now = new Date();
  const expires = new Date(entry.offerExpiresAt);
  if (now > expires) {
    res.status(410).json({ error: 'This booking offer has expired.' });
    return;
  }

  res.json(entry);
});

// --- SIMULATED EMAILS API ---

router.get('/emails', async (req, res) => {
  const logs = await dbInstance.getEmails();
  res.json(logs);
});

router.post('/emails/clear', async (req, res) => {
  await dbInstance.clearEmails();
  res.json({ success: true });
});

// --- ORGANISER REPORTING ---

router.get('/events/:id/reports', requireRole(['organiser', 'admin']), async (req, res) => {
  const showId = req.params.id;
  const events = await dbInstance.getEvents();
  const event = events.find(e => e.id === showId);
  if (!event) {
    res.status(404).json({ error: 'Event not found.' });
    return;
  }

  const seats = await dbInstance.getSeats(showId);
  const bookings = await dbInstance.getBookings();
  const waitlist = await dbInstance.getWaitlist(showId);

  const eventBookings = bookings.filter(b => b.showId === showId && b.status === 'confirmed');
  
  const totalSeats = seats.length;
  const bookedSeats = seats.filter(s => s.status === 'booked').length;
  const heldSeats = seats.filter(s => s.status === 'held').length;
  const availableSeats = seats.filter(s => s.status === 'available').length;

  const totalRevenue = eventBookings.reduce((sum, b) => sum + b.totalPrice, 0);

  // Revenue per category
  const categoryStats = {
    VIP: { booked: 0, total: 0, revenue: 0 },
    Premium: { booked: 0, total: 0, revenue: 0 },
    Standard: { booked: 0, total: 0, revenue: 0 }
  };

  seats.forEach(s => {
    if (categoryStats[s.category]) {
      categoryStats[s.category].total++;
      if (s.status === 'booked') {
        categoryStats[s.category].booked++;
        categoryStats[s.category].revenue += event.pricing[s.category] || 0;
      }
    }
  });

  res.json({
    eventTitle: event.title,
    eventDate: event.date,
    eventTime: event.time,
    totalSeats,
    bookedSeats,
    heldSeats,
    availableSeats,
    totalRevenue,
    fillRate: totalSeats > 0 ? ((bookedSeats / totalSeats) * 100).toFixed(1) : '0.0',
    waitlistCount: waitlist.length,
    categoryStats
  });
});

export default router;
