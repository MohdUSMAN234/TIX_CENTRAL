/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'customer' | 'organiser' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export type SeatCategory = 'Standard' | 'Premium' | 'VIP';

export interface SeatConfig {
  row: number;
  col: number;
  category: SeatCategory;
}

export interface Venue {
  id: string;
  name: string;
  rows: number;
  cols: number;
  layout: SeatConfig[]; // mapping of row/col to category
}

export interface EventPricing {
  Standard: number;
  Premium: number;
  VIP: number;
}

export interface EventListing {
  id: string;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  venueId: string;
  venueName: string;
  pricing: EventPricing;
  organiserId: string;
}

export type SeatStatus = 'available' | 'held' | 'booked';

export interface SeatState {
  id: string; 
  showId: string;
  row: number;
  col: number;
  category: SeatCategory;
  status: SeatStatus;
  heldBySessionId?: string; 
  heldByUserEmail?: string;
  heldUntil?: string; 
  bookedByEmail?: string;
  bookingId?: string;
}

export interface Booking {
  id: string;
  showId: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  seats: { row: number; col: number; category: SeatCategory; price: number }[];
  customerName: string;
  customerEmail: string;
  totalPrice: number;
  qrCode: string; // Base64 data URL
  status: 'confirmed' | 'cancelled';
  createdAt: string;
}

export interface WaitlistEntry {
  id: string;
  showId: string;
  eventTitle: string;
  customerName: string;
  customerEmail: string;
  category: SeatCategory;
  createdAt: string;
 
  offerSentAt?: string; 
  offerExpiresAt?: string; 
  offeredSeat?: { row: number; col: number };
}

export interface EmailLog {
  id: string;
  to: string;
  subject: string;
  body: string;
  qrCode?: string; 
  timestamp: string;
}

export interface SystemStats {
  totalRevenue: number;
  totalBookings: number;
  activeHolds: number;
  waitlistedCustomers: number;
}
