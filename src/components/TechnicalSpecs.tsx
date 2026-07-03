/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { FileText, Cpu, Server, Layers } from 'lucide-react';

export default function TechnicalSpecs() {
  return (
    <div className="bg-[#161618] border border-[#2A2A2E] p-6 rounded-none text-xs max-w-4xl mx-auto my-6 text-[#E0E0E0] font-mono">
      <div className="flex items-center gap-3 border-b border-[#2A2A2E] pb-4 mb-6">
        <FileText className="w-6 h-6 text-[#00F0FF]" />
        <div>
          <h2 className="font-mono font-bold text-base tracking-tight text-white uppercase">[03] SYSTEM DESIGN ARCHITECTURE</h2>
          <p className="font-mono text-[10px] text-gray-500">Document Rev: 1.0.4 • Target: Enterprise Seat Booking & Reallocation</p>
        </div>
      </div>

      <div className="space-y-6 text-gray-300 font-mono">
        
        {/* Section 1 */}
        <section className="space-y-2">
          <h3 className="font-mono font-bold text-sm flex items-center gap-2 text-white">
            <span className="font-mono bg-[#2A2A2E] text-[#00F0FF] px-1.5 py-0.5 text-[10px] border border-[#2A2A2E]">01</span>
            Seat Hold & TTL (Time-To-Live) Release Loop
          </h3>
          <p className="leading-relaxed text-[11px]">
            When a customer selects seats on the visual map, the backend establishes a session-locked reservation with a strict 
            <strong> Time-To-Live (TTL)</strong> timestamp (typically set to 10 minutes, configurable via request parameters). 
            Unlike fragile client-side countdowns, this hold is written directly to the database layer as a state constraint 
            (<code>status = 'held'</code>, <code>heldUntil = NOW + TTL</code>, and <code>heldByUserEmail = customerEmail</code>).
          </p>
          <p className="leading-relaxed text-[11px]">
            The release of abandoned holds is orchestrated on the server by an autonomous, non-blocking cron-like background loop. 
            This scheduler executes every 4 seconds, running a query that identifies all active records where <code>NOW &gt; heldUntil</code>. 
            When found, the system performs a cascading state transition: releasing the hold, erasing the session associations, 
            setting the seat status back to <code>available</code>, and immediately publishing a wake-up signal to trigger waitlist auto-allocation.
          </p>
        </section>

        {/* Section 2 */}
        <section className="space-y-2">
          <h3 className="font-mono font-bold text-sm flex items-center gap-2 text-white">
            <span className="font-mono bg-[#2A2A2E] text-[#00F0FF] px-1.5 py-0.5 text-[10px] border border-[#2A2A2E]">02</span>
            Concurrency Protection & Mutual Exclusion (Mutex)
          </h3>
          <p className="leading-relaxed text-[11px]">
            To prevent high-velocity double-booking anomalies, the system implements a strict <strong>Mutex (Mutual Exclusion)</strong> locking mechanism. 
            Because Node.js operates on a single-threaded event loop, asynchronous operations like read-modify-write are vulnerable to race conditions if multiple requests 
            check a seat's availability concurrently before committing the reservation.
          </p>
          <p className="leading-relaxed text-[11px]">
            Our system handles this by queuing all state-altering operations (holds, bookings, releases, and waitlist allocations) through a sequential 
            promise queue. When an operation is requested, it must acquire the lock from the <code>Mutex</code> instance. Once acquired, the thread reads 
            the absolute current state from disk, ensures no seat has changed status, commits the modifications, writes to disk, and only then releases the lock. 
            Any simultaneous transaction attempting to reserve the same seat is blocked until the first completes, causing the second attempt to gracefully 
            fail with a <code>409 Conflict</code> error, ensuring absolute transactional isolation.
          </p>
        </section>

        {/* Section 3 */}
        <section className="space-y-2">
          <h3 className="font-mono font-bold text-sm flex items-center gap-2 text-white">
            <span className="font-mono bg-[#2A2A2E] text-[#00F0FF] px-1.5 py-0.5 text-[10px] border border-[#2A2A2E]">03</span>
            Waitlist Auto-Assignment Pipeline
          </h3>
          <p className="leading-relaxed text-[11px]">
            When an event category (e.g., <em>Premium</em> or <em>VIP</em>) sells out, customers are offered the option to join a structured waitlist queue. 
            This waitlist is stored sequentially on disk (First-In, First-Out order) scoped by <code>showId</code> and <code>category</code>. 
            The moment a booking is cancelled or a seat hold expires, the system initiates the auto-assignment sequence:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-[11px]">
            <li>The background engine or cancellation trigger identifies the freed seat's category.</li>
            <li>It queries the waitlist table for the oldest (FIFO) user entry matching that category.</li>
            <li>If found, the seat is not released back to the general public. Instead, it is immediately shifted into a special <strong>waitlist-offer hold</strong>.</li>
            <li>The seat status remains locked, and an temporary 2-minute booking offer is locked to that waitlisted customer's email.</li>
          </ul>
        </section>

        {/* Section 4 */}
        <section className="space-y-2">
          <h3 className="font-mono font-bold text-sm flex items-center gap-2 text-white">
            <span className="font-mono bg-[#2A2A2E] text-[#00F0FF] px-1.5 py-0.5 text-[10px] border border-[#2A2A2E]">04</span>
            Time-Limited Offer Lifecycle & Graceful Escalation
          </h3>
          <p className="leading-relaxed text-[11px]">
            Upon transitioning a waitlisted user to an active offer, the backend dispatches a real-time notification containing a customized token link 
            (<code>/?claimOffer=WAITLIST_ID</code>). A strict 120-second deadline is stamped onto the waitlist entry (<code>offerExpiresAt = NOW + 2 minutes</code>).
          </p>
          <p className="leading-relaxed text-[11px]">
            If the customer clicks the link and completes checkout within 120 seconds, the seat converts to <code>booked</code>, and their waitlist entry is resolved. 
            If the deadline passes without action, the background TTL loop automatically invalidates the offer. 
            The seat status is reset to <code>available</code>, and the auto-assignment pipeline is immediately re-run. This pops the next customer in line 
            and repeats the process, ensuring zero seat vacancy rates while maintaining fair, automated reallocation.
          </p>
        </section>
      </div>

      <div className="mt-8 pt-4 border-t border-[#2A2A2E] flex flex-wrap justify-between items-center gap-4 font-mono text-[10px] text-gray-500">
        <div className="flex items-center gap-2">
          <Server className="w-3.5 h-3.5 text-[#00F0FF]" />
          <span>DB Schema: ACID-Compliant Local File Engine</span>
        </div>
        <div className="flex items-center gap-2">
          <Cpu className="w-3.5 h-3.5 text-[#00F0FF]" />
          <span>TTL Resolution: ~4000ms Poll Cycle</span>
        </div>
      </div>
    </div>
  );
}
