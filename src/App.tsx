/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Armchair, User, UserCheck, ShieldAlert, Cpu, CalendarDays, Ticket, History, LogOut, CheckCircle2, RefreshCw, X
} from 'lucide-react';

import { User as AppUser, EventListing, Booking, WaitlistEntry } from './types.js';
import EventCard from './components/EventCard.tsx';
import SeatMap from './components/SeatMap.tsx';
import AdminPanel from './components/AdminPanel.tsx';
import OrganiserDashboard from './components/OrganiserDashboard.tsx';
import TechnicalSpecs from './components/TechnicalSpecs.tsx';
import MailConsole from './components/MailConsole.tsx';

export default function App() {
  // Identities list for quick switcher (makes evaluation easy)
  const usersList: AppUser[] = [
    { id: 'u3', name: 'Milo Vance (Customer)', email: 'customer@booking.com', role: 'customer' },
    { id: 'u4', name: 'Zara Lin (Customer B)', email: 'zara@booking.com', role: 'customer' },
    { id: 'u2', name: 'Sophie Dupont (Organiser)', email: 'organiser@booking.com', role: 'organiser' },
    { id: 'u1', name: 'Albin Keller (System Admin)', email: 'admin@booking.com', role: 'admin' }
  ];

  const [currentUser, setCurrentUser] = useState<AppUser | null>(usersList[0]);
  const [activeTab, setActiveTab] = useState<'events' | 'admin' | 'tech'>('events');
  const [events, setEvents] = useState<EventListing[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventListing | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [claimOfferId, setClaimOfferId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Load events and user-specific bookings/waitlists
  const loadData = async () => {
    setIsRefreshing(true);
    try {
      const resEvents = await fetch('/api/events');
      if (resEvents.ok) {
        const eventsData = await resEvents.json();
        setEvents(eventsData);
        if (eventsData.length > 0 && !selectedEvent) {
          setSelectedEvent(eventsData[0]);
        }
      }

      if (currentUser) {
        const headers = {
          'x-user-role': currentUser.role,
          'x-user-email': currentUser.email,
          'x-user-id': currentUser.id
        };

        const resBookings = await fetch('/api/bookings', { headers });
        if (resBookings.ok) {
          setBookings(await resBookings.json());
        }

        const resWaitlist = await fetch('/api/waitlist', { headers });
        if (resWaitlist.ok) {
          setWaitlist(await resWaitlist.json());
        }
      }
    } catch (e) {
      console.error('Failed to load full-stack details:', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser]);

  // Intercept Offer link claims from URL / Dev email inbox triggers
  useEffect(() => {
    const checkClaimQuery = () => {
      const params = new URLSearchParams(window.location.search);
      const offerId = params.get('claimOffer');
      if (offerId) {
        setClaimOfferId(offerId);
        // Find waitlist details
        fetch(`/api/waitlist/offer/${offerId}`)
          .then(res => res.json())
          .then(data => {
            if (!data.error) {
              const matchedEvent = events.find(e => e.id === data.showId);
              if (matchedEvent) {
                setSelectedEvent(matchedEvent);
                setActiveTab('events');
              }
            }
          });
        // Clear query parameter from address bar
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    };

    if (events.length > 0) {
      checkClaimQuery();
    }
  }, [events]);

  const handleCancelBooking = async (bookingId: string) => {
    if (!window.confirm('Are you sure you want to cancel this booking? This will immediately offer the seat to the waitlisted queue.')) {
      return;
    }
    try {
      const res = await fetch(`/api/bookings/${bookingId}/cancel`, { method: 'POST' });
      if (res.ok) {
        loadData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const filteredEvents = events.filter(e => 
    e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.venueName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0F0F10] text-[#E0E0E0] flex flex-col font-mono selection:bg-[#00F0FF] selection:text-black">
      
      {/* HEADER CONTROLLER (Identity Matrix Switcher) */}
      <header className="bg-[#161618] text-white py-4 px-4 md:px-8 border-b border-[#2A2A2E] flex flex-col md:flex-row justify-between items-center gap-4">
        
        {/* Logo/Identity */}
        <div className="flex items-center gap-3">
          <div className="bg-[#00F0FF] p-1.5 rounded-none rotate-45 border border-[#2A2A2E]">
            <Armchair className="w-4 h-4 text-black -rotate-45" />
          </div>
          <div>
            <h1 className="font-mono font-black text-xl tracking-tighter text-white uppercase leading-none">TIX-CENTRAL_v4.2</h1>
            <p className="font-mono text-[9px] text-[#00F0FF] font-bold tracking-widest uppercase mt-0.5">CONCURRENT_TRANSACTION_ENGINE</p>
          </div>
        </div>

        {/* Quick Identity Toggler */}
        <div className="flex items-center gap-3 bg-[#0F0F10] border border-[#2A2A2E] p-2 rounded-none max-w-full overflow-x-auto">
          <span className="font-mono text-[10px] text-gray-400 flex items-center gap-1 shrink-0 font-bold">
            <UserCheck className="w-3.5 h-3.5 text-[#00F0FF]" />
            IDENTITY_MATRIX:
          </span>
          <div className="flex gap-1.5 shrink-0">
            {usersList.map((user) => {
              const active = currentUser?.id === user.id;
              let roleColor = 'border-[#2A2A2E] text-gray-500 hover:text-white';
              if (active) {
                if (user.role === 'admin') roleColor = 'bg-[#00F0FF]/20 text-[#00F0FF] border-[#00F0FF] font-bold';
                else if (user.role === 'organiser') roleColor = 'bg-[#00F0FF]/10 text-[#00F0FF] border-[#00F0FF]/50 font-bold';
                else roleColor = 'bg-[#00F0FF] text-black border-[#00F0FF] font-bold';
              }
              return (
                <button
                  key={user.id}
                  onClick={() => {
                    setCurrentUser(user);
                    setClaimOfferId(null);
                  }}
                  className={`font-mono text-[10px] px-2.5 py-1 rounded-none border transition-all ${roleColor}`}
                >
                  {user.name.split(' ')[0]}
                </button>
              );
            })}
          </div>
        </div>

      </header>

      {/* SUB-HEADER MENU (Primary Tab Rail) */}
      <nav className="bg-[#121214] border-b border-[#2A2A2E] px-4 md:px-8 py-2.5 flex flex-wrap justify-between items-center gap-4">
        <div className="flex gap-1.5">
          <button
            onClick={() => setActiveTab('events')}
            className={`font-mono font-bold text-xs px-4 py-2.5 rounded-none border transition-all flex items-center gap-2 ${
              activeTab === 'events'
                ? 'bg-[#161618] text-white border-[#00F0FF] shadow-[0_0_8px_rgba(0,240,255,0.15)]'
                : 'border-transparent text-gray-400 hover:text-white hover:bg-[#161618]'
            }`}
          >
            <CalendarDays className="w-4 h-4 text-[#00F0FF]" />
            [01] SHOWS_&_EVENTS
          </button>

          {/* Conditional Admin / Organiser Tabs embedded gracefully */}
          {(currentUser?.role === 'admin' || currentUser?.role === 'organiser') && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`font-mono font-bold text-xs px-4 py-2.5 rounded-none border transition-all flex items-center gap-2 ${
                activeTab === 'admin'
                  ? 'bg-[#161618] text-white border-[#00F0FF] shadow-[0_0_8px_rgba(0,240,255,0.15)]'
                  : 'border-transparent text-gray-400 hover:text-white hover:bg-[#161618]'
              }`}
            >
              <Cpu className="w-4 h-4 text-[#00F0FF]" />
              [02] {currentUser.role === 'admin' ? 'ADMIN_VENUE_CONTROL' : 'ORGANISER_MANAGEMENT'}
            </button>
          )}

          <button
            onClick={() => setActiveTab('tech')}
            className={`font-mono font-bold text-xs px-4 py-2.5 rounded-none border transition-all flex items-center gap-2 ${
              activeTab === 'tech'
                ? 'bg-[#161618] text-white border-[#00F0FF] shadow-[0_0_8px_rgba(0,240,255,0.15)]'
                : 'border-transparent text-gray-400 hover:text-white hover:bg-[#161618]'
            }`}
          >
            <ShieldAlert className="w-4 h-4 text-cyber-gold" />
            [03] TECHNICAL_LOGS
          </button>
        </div>

        {/* Global actions/status */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <button
            onClick={loadData}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 bg-[#161618] border border-[#2A2A2E] rounded-none px-2.5 py-1.5 text-[#E0E0E0] hover:border-[#00F0FF] hover:text-[#00F0FF] disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#00F0FF] ${isRefreshing ? 'animate-spin' : ''}`} />
            SYNC_DB
          </button>
          <span className="text-[#2A2A2E]">|</span>
          <span className="text-[#888] bg-[#161618] border border-[#2A2A2E] px-2 py-1 rounded-none text-[9px] font-bold">
            SESSION_ROLE: <span className="text-[#00F0FF] uppercase">{currentUser?.role}</span>
          </span>
        </div>
      </nav>

      {/* CORE FRAMEWORK STAGE */}
      <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto space-y-8">
        
        {/* --- TAB 1: RESERVATIONS ENGINE --- */}
        {activeTab === 'events' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Hand Section: Event Listings Index & Active Bookings */}
            <div className="space-y-6 lg:col-span-1">
              
              {/* Event Searching */}
              <div className="bg-[#161618] border border-[#2A2A2E] p-5 rounded-none space-y-3">
                <span className="font-mono text-[10px] text-[#00F0FF] font-bold uppercase tracking-wider block">[01] SEARCH_LISTINGS</span>
                <input
                  type="text"
                  placeholder="Filter by title, artist, venue..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#0F0F10] border border-[#2A2A2E] rounded-none p-2 text-xs font-mono text-white placeholder-gray-600 focus:border-[#00F0FF] focus:outline-none"
                />
              </div>

              {/* Event List */}
              <div className="space-y-3">
                <span className="font-mono text-[10px] text-[#00F0FF] font-bold uppercase tracking-wider block">[02] SHOW_RUN_INDEX ({filteredEvents.length})</span>
                {filteredEvents.length === 0 ? (
                  <div className="p-8 text-center border border-[#2A2A2E] rounded-none text-neutral-500 font-mono text-xs bg-[#161618]">
                    No matching events on scheduling logs.
                  </div>
                ) : (
                  filteredEvents.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      isSelected={selectedEvent?.id === event.id}
                      onSelect={() => {
                        setSelectedEvent(event);
                        setClaimOfferId(null);
                      }}
                    />
                  ))
                )}
              </div>

              {/* User Activity Dashboard (Bookings & Waitlist) */}
              {currentUser?.role === 'customer' && (
                <div className="bg-[#161618] border border-[#2A2A2E] p-5 rounded-none space-y-5">
                  
                  {/* Bookings */}
                  <div className="space-y-3.5">
                    <div className="flex items-center gap-1.5 border-b border-[#2A2A2E] pb-2">
                      <History className="w-4 h-4 text-[#00F0FF]" />
                      <span className="font-mono font-bold text-xs text-white uppercase">[03] YOUR_BOOKINGS ({bookings.length})</span>
                    </div>
                    
                    {bookings.length === 0 ? (
                      <p className="font-mono text-[10px] text-gray-500 py-1">No active tickets booked.</p>
                    ) : (
                      <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                        {bookings.map((b) => (
                          <div key={b.id} className="bg-[#0F0F10] p-3 rounded-none border border-[#2A2A2E] text-xs font-mono space-y-1.5">
                            <div className="flex justify-between font-bold">
                              <span className="truncate max-w-[140px] text-white">{b.eventTitle}</span>
                              <span className={b.status === 'confirmed' ? 'text-green-400' : 'text-red-400'}>
                                {b.status.toUpperCase()}
                              </span>
                            </div>
                            <p className="text-[10px] text-gray-400">
                              Ref: {b.id} • Seats: {b.seats.map(s => `R${s.row}C${s.col}`).join(',')}
                            </p>
                            
                            {b.status === 'confirmed' && (
                              <button
                                onClick={() => handleCancelBooking(b.id)}
                                className="text-[10px] text-red-400 font-bold hover:underline hover:text-red-300"
                              >
                                Cancel Ticket
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Waitlist Position */}
                  <div className="space-y-3 pt-3 border-t border-dashed border-[#2A2A2E]">
                    <div className="flex items-center gap-1.5">
                      <Ticket className="w-4 h-4 text-[#FFB300]" />
                      <span className="font-mono font-bold text-xs text-white uppercase">[04] QUEUED_WAITLISTS ({waitlist.length})</span>
                    </div>

                    {waitlist.length === 0 ? (
                      <p className="font-mono text-[10px] text-gray-500 py-1">No active waitlist queues.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-[120px] overflow-y-auto">
                        {waitlist.map((w) => (
                          <div key={w.id} className="bg-[#0F0F10] p-2.5 rounded-none border border-[#2A2A2E] text-[11px] font-mono flex justify-between items-center">
                            <div>
                              <p className="font-bold text-white truncate max-w-[150px]">{w.eventTitle}</p>
                              <p className="text-[9px] text-gray-400">Zone: {w.category}</p>
                            </div>
                            <span className="bg-[#FFB300]/10 text-[#FFB300] border border-[#FFB300]/30 px-1.5 py-0.5 rounded-none text-[8px] font-bold">
                              {w.offeredSeat ? 'OFFER SENT' : 'QUEUED'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              )}

            </div>

            {/* Right Hand Section: Live Seating Grid workspace */}
            <div className="lg:col-span-2 space-y-6">
              {selectedEvent ? (
                <div className="space-y-4">
                  <div className="bg-[#161618] text-white p-4 rounded-none border border-[#2A2A2E] flex justify-between items-center">
                    <div>
                      <span className="font-mono text-[10px] text-[#00F0FF] font-bold uppercase tracking-widest">[INFRA_MAP] ACTIVE SEATING STAGE</span>
                      <h2 className="font-mono font-black text-lg text-white leading-none mt-1 uppercase">{selectedEvent.title}</h2>
                    </div>
                    <div className="text-right font-mono text-xs">
                      <p className="text-gray-400">Date: {selectedEvent.date}</p>
                      <p className="text-gray-400">Time: {selectedEvent.time}</p>
                    </div>
                  </div>

                  {claimOfferId && (
                    <div className="bg-[#FFB300]/10 border border-[#FFB300]/30 p-3 rounded-none flex justify-between items-center">
                      <span className="font-mono text-xs font-bold text-[#FFB300]">
                        🔗 Waitlist Offer Link claimed. Checkout seat automatically selected!
                      </span>
                      <button 
                        onClick={() => setClaimOfferId(null)}
                        className="p-1 text-[#FFB300] hover:bg-[#FFB300]/10 rounded-none"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  <SeatMap
                    showId={selectedEvent.id}
                    event={selectedEvent}
                    currentUser={currentUser}
                    claimOfferId={claimOfferId || undefined}
                    onBookingSuccess={loadData}
                  />
                </div>
              ) : (
                <div className="py-24 border border-dashed border-[#2A2A2E] rounded-none text-center text-gray-500 font-mono text-xs bg-[#161618]">
                  Please register or select an active Event from the left-hand column index to map the theater room.
                </div>
              )}
            </div>

          </div>
        )}

        {/* --- TAB 2: SYSTEM MANAGEMENT (Conditional) --- */}
        {activeTab === 'admin' && currentUser && (
          <div>
            {currentUser.role === 'admin' ? (
              <AdminPanel onVenueCreated={loadData} />
            ) : currentUser.role === 'organiser' ? (
              <OrganiserDashboard 
                onEventCreated={loadData} 
                currentUserEmail={currentUser.email}
                currentUserId={currentUser.id}
              />
            ) : (
              <div className="p-8 text-center bg-red-950/20 border border-red-900/50 rounded-none text-red-400 font-mono text-xs">
                Access Denied. Switched test identity to Admin or Organiser above.
              </div>
            )}
          </div>
        )}

        {/* --- TAB 3: TECHNICAL SPECIFICATIONS WRITE-UP --- */}
        {activeTab === 'tech' && (
          <TechnicalSpecs />
        )}

      </main>

      {/* FLOAT DEV COMM PANEL (Mail simulator box) */}
      <MailConsole />

      {/* FOOTER STATS */}
      <footer className="bg-[#121214] border-t border-[#2A2A2E] py-4 px-4 md:px-8 mt-auto text-center font-mono text-[9px] text-gray-600">
        <p>SYSTEM_KERNEL: v1.0.4-bento • ENCRYPTION: AES-256 • TRANSACTION_ISOLATION: MUTEX_SERIALIZED</p>
      </footer>

    </div>
  );
}
