/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Armchair, Clock, Lock, User, PlusCircle, AlertTriangle, Sparkles } from 'lucide-react';
import { SeatState, SeatCategory, User as AppUser, EventListing } from '../types.js';

interface SeatMapProps {
  showId: string;
  event: EventListing;
  currentUser: AppUser | null;
  onBookingSuccess: () => void;
  claimOfferId?: string; // offer waitlist flow
}

export default function SeatMap({ showId, event, currentUser, onBookingSuccess, claimOfferId }: SeatMapProps) {
  const [seats, setSeats] = useState<SeatState[]>([]);
  const [selectedSeats, setSelectedSeats] = useState<{ row: number; col: number }[]>([]);
  const [isHolding, setIsHolding] = useState(false);
  const [holdTimer, setHoldTimer] = useState<number | null>(null); // in seconds
  const [holdExpiration, setHoldExpiration] = useState<string | null>(null);
  const [waitlistCategory, setWaitlistCategory] = useState<SeatCategory>('Standard');
  const [isWaitlisting, setIsWaitlisting] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Waitlist claim state
  const [activeOffer, setActiveOffer] = useState<any | null>(null);

  // Fetch seats data
  const fetchSeats = async () => {
    try {
      const res = await fetch(`/api/events/${showId}/seats`);
      if (res.ok) {
        const data = await res.json();
        setSeats(data);
      }
    } catch (e) {
      console.error('Failed to load seats:', e);
    }
  };

  // Poll seats every 4 seconds for real-time status changes
  useEffect(() => {
    fetchSeats();
    const interval = setInterval(() => {
      fetchSeats();
    }, 4000);
    return () => clearInterval(interval);
  }, [showId]);

  // If there's an active offer to claim, load details
  useEffect(() => {
    if (claimOfferId) {
      fetch(`/api/waitlist/offer/${claimOfferId}`)
        .then(res => res.json())
        .then(data => {
          if (!data.error) {
            setActiveOffer(data);
            // Pre-select offered seat
            setSelectedSeats([data.offeredSeat]);
            // Set mock timer for waitlist offer expiry
            const timeDiff = Math.max(0, Math.floor((new Date(data.offerExpiresAt).getTime() - Date.now()) / 1000));
            setHoldTimer(timeDiff);
            setIsHolding(true);
          } else {
            setMsg({ type: 'error', text: data.error });
          }
        });
    }
  }, [claimOfferId]);

  // Hold Timer countdown hook
  useEffect(() => {
    if (holdTimer !== null && holdTimer > 0 && isHolding) {
      const t = setTimeout(() => {
        setHoldTimer(holdTimer - 1);
      }, 1000);
      return () => clearTimeout(t);
    } else if (holdTimer === 0 && isHolding) {
      handleHoldExpiration();
    }
  }, [holdTimer, isHolding]);

  const handleHoldExpiration = async () => {
    setIsHolding(false);
    setHoldTimer(null);
    setSelectedSeats([]);
    setMsg({ type: 'error', text: '⏱️ Reservation Hold Expired! Seats have been auto-released.' });
    
    // Release on server
    if (currentUser && !activeOffer) {
      await fetch(`/api/events/${showId}/release`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentUser.email })
      });
    }
    fetchSeats();
  };

  // Check if a seat is currently selected
  const isSelected = (row: number, col: number) => {
    return selectedSeats.some(s => s.row === row && s.col === col);
  };

  // Handle seat clicks
  const handleSeatClick = async (seat: SeatState) => {
    if (!currentUser) {
      setMsg({ type: 'error', text: 'Please select a system user identity at the top to interact.' });
      return;
    }

    // Admins can toggle seat categories to dynamically rewrite layout!
    if (currentUser.role === 'admin') {
      const categories: SeatCategory[] = ['Standard', 'Premium', 'VIP'];
      const nextIdx = (categories.indexOf(seat.category) + 1) % categories.length;
      const nextCategory = categories[nextIdx];
      
      // Update locally
      setSeats(seats.map(s => s.id === seat.id ? { ...s, category: nextCategory } : s));
      setMsg({ type: 'success', text: `Admin: Toggled Row ${seat.row} Col ${seat.col} to [${nextCategory}]` });
      return;
    }

    // Customer interactions
    if (seat.status === 'booked') return;
    if (seat.status === 'held' && seat.heldByUserEmail !== currentUser.email) return;

    // Waitlist offer locked seat
    if (activeOffer) {
      setMsg({ type: 'error', text: 'This is your exclusive waitlist seat offer. Complete checkout below!' });
      return;
    }

    const alreadySelected = isSelected(seat.row, seat.col);
    let updatedSelection: { row: number; col: number }[];

    if (alreadySelected) {
      updatedSelection = selectedSeats.filter(s => !(s.row === seat.row && s.col === seat.col));
    } else {
      updatedSelection = [...selectedSeats, { row: seat.row, col: seat.col }];
    }

    setSelectedSeats(updatedSelection);

    // Automatically trigger temporary hold if user selected something
    if (updatedSelection.length > 0) {
      setIsHolding(true);
      // Initiate / refresh hold TTL on server to protect concurrency
      try {
        const response = await fetch(`/api/events/${showId}/hold`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            seats: updatedSelection,
            email: currentUser.email,
            name: currentUser.name,
            ttlSeconds: 120 // 2 minutes hold for faster dev testing
          })
        });

        const data = await response.json();
        if (response.ok) {
          setHoldTimer(120);
          setHoldExpiration(data.heldUntil);
          setMsg(null);
        } else {
          // Double booking caught!
          setSelectedSeats([]);
          setIsHolding(false);
          setHoldTimer(null);
          setMsg({ type: 'error', text: data.error || 'Conflict detected!' });
          fetchSeats();
        }
      } catch (e) {
        console.error(e);
      }
    } else {
      // Released all
      setIsHolding(false);
      setHoldTimer(null);
      await fetch(`/api/events/${showId}/release`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentUser.email })
      });
      setMsg(null);
      fetchSeats();
    }
  };

  // Complete Booking
  const handleConfirmBooking = async () => {
    if (!currentUser || selectedSeats.length === 0) return;

    try {
      const response = await fetch(`/api/events/${showId}/book`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-role': currentUser.role,
          'x-user-email': currentUser.email,
          'x-user-id': currentUser.id
        },
        body: JSON.stringify({
          seats: selectedSeats,
          name: currentUser.name,
          email: currentUser.email,
          holdToken: currentUser.email // use email as simple session lock token
        })
      });

      const data = await response.json();
      if (response.ok) {
        setMsg({ type: 'success', text: `🎟️ SUCCESS! Booking ${data.booking.id} confirmed. Check the Dev Mail Terminal below for your QR ticket!` });
        setSelectedSeats([]);
        setIsHolding(false);
        setHoldTimer(null);
        setActiveOffer(null);
        fetchSeats();
        onBookingSuccess();
      } else {
        setMsg({ type: 'error', text: data.error || 'Failed to complete booking.' });
      }
    } catch (e) {
      console.error(e);
      setMsg({ type: 'error', text: 'Network booking error.' });
    }
  };

  // Join Waitlist
  const handleJoinWaitlist = async () => {
    if (!currentUser) return;
    setIsWaitlisting(true);

    try {
      const response = await fetch(`/api/events/${showId}/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: currentUser.name,
          email: currentUser.email,
          category: waitlistCategory
        })
      });

      const data = await response.json();
      if (response.ok) {
        setMsg({ type: 'success', text: `🕒 Waitlisted! You have queued up for [${waitlistCategory}] seats. Check Mailbox for alerts!` });
      } else {
        setMsg({ type: 'error', text: data.error || 'Failed to join waitlist.' });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsWaitlisting(false);
    }
  };

  // Organize seat states into rows
  const maxRow = seats.reduce((max, s) => Math.max(max, s.row), 0);
  const maxCol = seats.reduce((max, s) => Math.max(max, s.col), 0);
  
  const renderRows = [];
  for (let r = 1; r <= maxRow; r++) {
    const rowSeats = seats.filter(s => s.row === r).sort((a, b) => a.col - b.col);
    renderRows.push(rowSeats);
  }

  // Calculate pricing based on category
  const calculateTotal = () => {
    return selectedSeats.reduce((sum, s) => {
      const seat = seats.find(x => x.row === s.row && x.col === s.col);
      if (!seat) return sum;
      return sum + (event.pricing[seat.category] || event.pricing.Standard);
    }, 0);
  };

  return (
    <div className="bg-[#161618] border border-[#2A2A2E] p-6 rounded-none flex flex-col md:flex-row gap-8">
      
      {/* LEFT COLUMN: VISUAL MAP */}
      <div className="flex-1 flex flex-col items-center">
        <div className="w-full text-center mb-6">
          <span className="font-mono text-xs bg-[#0F0F10] text-[#00F0FF] px-3 py-1 border border-[#2A2A2E] rounded-none font-bold uppercase tracking-widest">
            STAGE / SCREEN AREA
          </span>
          <div className="w-full h-1.5 bg-[#2A2A2E] rounded-none mt-2"></div>
        </div>

        {/* Dynamic Grid Layout */}
        <div className="flex flex-col gap-3.5 my-4 bg-[#0F0F10] p-6 border border-[#2A2A2E] rounded-none w-full overflow-x-auto items-center">
          {renderRows.length === 0 ? (
            <div className="py-8 font-mono text-xs text-neutral-500">Loading seat matrices...</div>
          ) : (
            renderRows.map((rowSeats, rIdx) => (
              <div key={rIdx} className="flex gap-3.5 items-center">
                {/* Row Letter */}
                <span className="font-mono text-xs font-bold text-gray-500 w-5 text-center">
                  {String.fromCharCode(65 + rIdx)}
                </span>
                
                {rowSeats.map((seat) => {
                  const selected = isSelected(seat.row, seat.col);
                  
                  // Color codes
                  let statusClass = "bg-[#161618] text-[#E0E0E0] border-[#2A2A2E] hover:border-[#00F0FF] hover:text-white";
                  let icon = <Armchair className="w-4 h-4" />;
                  let titleTip = `Row ${seat.row} Col ${seat.col} (${seat.category})`;

                  if (seat.status === 'booked') {
                    statusClass = "bg-[#222225] text-gray-700 border-[#2A2A2E] cursor-not-allowed opacity-40";
                    icon = <User className="w-4 h-4 text-gray-700" />;
                  } else if (seat.status === 'held') {
                    if (currentUser && seat.heldByUserEmail === currentUser.email) {
                      // Held by current user
                      statusClass = "bg-[#00F0FF]/15 text-[#00F0FF] border-[#00F0FF] border led-glow-green animate-pulse";
                    } else {
                      // Held by someone else
                      statusClass = "bg-[#FFB300]/10 text-[#FFB300] border-[#FFB300] border led-glow-amber cursor-not-allowed";
                      icon = <Lock className="w-3.5 h-3.5" />;
                    }
                  } else if (selected) {
                    statusClass = "bg-[#00F0FF] text-black border-[#00F0FF] font-black shadow-[0_0_10px_rgba(0,240,255,0.4)]";
                  } else {
                    // Available with category-specific style
                    if (seat.category === 'VIP') {
                      statusClass = "bg-[#1C1625] text-purple-400 border-purple-900/60 hover:border-[#00F0FF]";
                    } else if (seat.category === 'Premium') {
                      statusClass = "bg-[#121A25] text-blue-400 border-blue-900/60 hover:border-[#00F0FF]";
                    }
                  }

                  return (
                    <button
                      key={seat.id}
                      onClick={() => handleSeatClick(seat)}
                      disabled={seat.status === 'booked' || (seat.status === 'held' && currentUser && seat.heldByUserEmail !== currentUser.email)}
                      className={`w-9 h-9 rounded-none flex items-center justify-center border text-xs font-mono transition-all ${statusClass}`}
                      title={`${titleTip} - $${event.pricing[seat.category] || event.pricing.Standard}`}
                    >
                      {selected ? seat.col : icon}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-4 justify-center font-mono text-[10px] text-gray-400 border-t border-dashed border-[#2A2A2E] pt-4 w-full">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 bg-[#161618] border border-[#2A2A2E] rounded-none block"></span>
            <span>Standard (${event.pricing.Standard})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 bg-[#121A25] border border-blue-900/60 rounded-none block"></span>
            <span>Premium (${event.pricing.Premium})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 bg-[#1C1625] border border-purple-900/60 rounded-none block"></span>
            <span>VIP (${event.pricing.VIP})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 bg-[#00F0FF]/15 border border-[#00F0FF] rounded-none block animate-pulse"></span>
            <span>Held (You)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 bg-[#FFB300]/10 border border-[#FFB300] rounded-none block"></span>
            <span>Held (Locked)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 bg-[#222225] border border-[#2A2A2E] rounded-none block opacity-40"></span>
            <span>Booked</span>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: ACTION CONTROLS */}
      <div className="w-full md:w-[280px] border-t md:border-t-0 md:border-l border-[#2A2A2E] pt-6 md:pt-0 md:pl-6 flex flex-col justify-between">
        <div className="space-y-5">
          <div className="border-b border-[#2A2A2E] pb-2">
            <span className="text-[10px] text-[#00F0FF] font-bold block uppercase">[02] CHECKOUT_CONSOLE</span>
            <h3 className="font-mono font-bold text-sm tracking-tight text-white uppercase mt-0.5">{event.title}</h3>
          </div>

          {/* Messages Alerts */}
          {msg && (
            <div className={`p-3 rounded-none text-[10px] font-mono border ${
              msg.type === 'success' 
                ? 'bg-[#00FF66]/10 text-green-400 border-green-500/50' 
                : 'bg-[#FF3366]/10 text-red-400 border-red-500/50'
            }`}>
              {msg.text}
            </div>
          )}

          {/* Active Seat offer notification for waitlist */}
          {activeOffer && (
            <div className="bg-[#00F0FF]/10 border border-[#00F0FF]/30 rounded-none p-3 text-xs space-y-2">
              <div className="flex items-center gap-1.5 text-[#00F0FF] font-bold font-mono uppercase">
                <Sparkles className="w-4 h-4 text-[#00F0FF]" />
                WAITLIST OFFER SENT
              </div>
              <p className="font-mono text-[10px] text-gray-300 leading-relaxed">
                Seat <strong>Row {activeOffer.offeredSeat.row} Col {activeOffer.offeredSeat.col}</strong> is locked to your session.
              </p>
            </div>
          )}

          {/* Hold Countdown Ticker */}
          {isHolding && holdTimer !== null && (
            <div className="bg-[#FF3366]/10 border border-red-500/50 rounded-none p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-red-400 animate-spin" />
                <span className="font-mono text-[10px] font-bold text-red-400 uppercase">SECURE HOLD TTL</span>
              </div>
              <span className="font-mono text-xs font-black text-red-400">
                {Math.floor(holdTimer / 60)}:{(holdTimer % 60).toString().padStart(2, '0')}
              </span>
            </div>
          )}

          {/* Selected Seat Summaries */}
          {selectedSeats.length > 0 ? (
            <div className="space-y-2.5">
              <span className="font-mono text-[10px] text-gray-500 block">SELECTED_SEATS:</span>
              <div className="max-h-[140px] overflow-y-auto border border-[#2A2A2E] rounded-none divide-y divide-[#2A2A2E] bg-[#0F0F10]">
                {selectedSeats.map((s, idx) => {
                  const seat = seats.find(x => x.row === s.row && x.col === s.col);
                  if (!seat) return null;
                  const price = event.pricing[seat.category] || event.pricing.Standard;
                  return (
                    <div key={idx} className="flex justify-between items-center p-2.5 text-xs font-mono">
                      <span className="text-gray-400">Row {String.fromCharCode(64 + s.row)}-{s.col} ({seat.category})</span>
                      <span className="font-bold text-white">${price}</span>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between items-center border-t border-[#2A2A2E] pt-3 font-mono">
                <span className="font-bold text-xs text-gray-400 uppercase">TOTAL CHARGE:</span>
                <span className="font-black text-sm text-[#00F0FF]">${calculateTotal()}</span>
              </div>

              {currentUser?.role === 'customer' || currentUser?.role === 'admin' ? (
                <button
                  onClick={handleConfirmBooking}
                  className="w-full bg-[#00F0FF] hover:bg-[#00D1E0] text-black font-mono font-bold text-xs py-3 rounded-none active:translate-y-0.5 transition-all uppercase tracking-wide border-0"
                >
                  Confirm and Book Ticket
                </button>
              ) : (
                <div className="text-center font-mono text-[10px] text-orange-400 bg-orange-950/20 p-2.5 border border-orange-900/50">
                  Select a <strong>Customer</strong> role at top to confirm bookings.
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6 text-neutral-500 font-mono text-xs border border-dashed border-[#2A2A2E] rounded-none bg-[#0F0F10] p-4">
              Click available seats on the map to place a temporal TTL concurrency lock.
            </div>
          )}
        </div>

        {/* WAITLIST INLET (Always available when theater gets full or as user preference) */}
        <div className="mt-6 border-t border-[#2A2A2E] pt-4 space-y-3.5">
          <div className="flex items-center gap-1.5 text-white">
            <AlertTriangle className="w-4 h-4 text-[#FFB300]" />
            <span className="font-mono font-bold text-xs uppercase tracking-tight">WAITLIST ENROLLMENT</span>
          </div>
          <p className="font-mono text-[10px] text-gray-500 leading-normal">
            If your preferred category is sold out, queue up below to get automatic time-limited booking offers on cancellation.
          </p>

          <div className="flex gap-2">
            <select
              value={waitlistCategory}
              onChange={(e) => setWaitlistCategory(e.target.value as SeatCategory)}
              className="flex-1 bg-[#0F0F10] border border-[#2A2A2E] rounded-none p-1.5 font-mono text-xs text-white focus:outline-none focus:border-[#00F0FF]"
            >
              <option value="Standard">Standard</option>
              <option value="Premium">Premium</option>
              <option value="VIP">VIP</option>
            </select>
            
            <button
              onClick={handleJoinWaitlist}
              disabled={!currentUser || isWaitlisting}
              className="bg-[#FFB300] hover:bg-[#E5A000] text-black font-mono font-bold text-[11px] px-3 py-1.5 rounded-none active:translate-y-0.5 transition-all disabled:opacity-50"
            >
              Queue Up
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
