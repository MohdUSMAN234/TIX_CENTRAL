/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { PlusCircle, Database, LayoutGrid, Server, Check } from 'lucide-react';
import { Venue, SeatConfig, SeatCategory } from '../types.js';

interface AdminPanelProps {
  onVenueCreated: () => void;
}

export default function AdminPanel({ onVenueCreated }: AdminPanelProps) {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [name, setName] = useState('');
  const [rows, setRows] = useState(6);
  const [cols, setCols] = useState(8);
  const [msg, setMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchVenues = async () => {
    try {
      const res = await fetch('/api/venues');
      if (res.ok) {
        const data = await res.json();
        setVenues(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchVenues();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || rows <= 0 || cols <= 0) return;
    setIsSubmitting(true);
    setMsg('');

    // Pre-calculate initial layout map
    const layout: SeatConfig[] = [];
    for (let r = 1; r <= rows; r++) {
      for (let c = 1; c <= cols; c++) {
        let category: SeatCategory = 'Standard';
        if (r <= Math.ceil(rows * 0.25)) category = 'VIP';
        else if (r <= Math.ceil(rows * 0.6)) category = 'Premium';
        layout.push({ row: r, col: c, category });
      }
    }

    try {
      const res = await fetch('/api/venues', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-role': 'admin' 
        },
        body: JSON.stringify({ name, rows, cols, layout })
      });

      if (res.ok) {
        setMsg('Venue created successfully!');
        setName('');
        setRows(6);
        setCols(8);
        fetchVenues();
        onVenueCreated();
      } else {
        const data = await res.json();
        setMsg(data.error || 'Failed to create venue.');
      }
    } catch (e) {
      console.error(e);
      setMsg('Network error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-[#2A2A2E] pb-2">
        <span className="font-mono text-[10px] text-[#00F0FF] font-bold uppercase tracking-wider block">[SYS_CONFIG] DIRECTORY COMMANDS</span>
        <h2 className="font-mono font-black text-lg text-white tracking-tight mt-0.5 uppercase">ADMIN VENUE MANAGER</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Left Side: Create Venue Form */}
        <div className="bg-[#161618] border border-[#2A2A2E] p-5 rounded-none">
          <h3 className="font-mono font-bold text-xs text-white mb-4 flex items-center gap-2 uppercase tracking-wide">
            <PlusCircle className="w-4 h-4 text-[#00F0FF]" />
            INITIALIZE NEW VENUE
          </h3>

          {msg && (
            <div className="mb-4 p-2.5 rounded-none bg-[#00F0FF]/10 border border-[#00F0FF]/30 font-mono text-[10px] text-[#00F0FF]">
              {msg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 font-mono text-xs text-[#E0E0E0]">
            <div className="space-y-1">
              <label className="block text-gray-400 font-bold uppercase">VENUE NAME / AUDITORIUM</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Grand Concert Hall A"
                className="w-full bg-[#0F0F10] border border-[#2A2A2E] rounded-none p-2 text-white placeholder-gray-700 focus:outline-none focus:border-[#00F0FF]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-gray-400 font-bold uppercase">GRID ROWS (1-12)</label>
                <input
                  type="number"
                  min="1"
                  max="12"
                  required
                  value={rows}
                  onChange={(e) => setRows(Number(e.target.value))}
                  className="w-full bg-[#0F0F10] border border-[#2A2A2E] rounded-none p-2 text-white focus:outline-none focus:border-[#00F0FF]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-gray-400 font-bold uppercase">GRID COLS (1-12)</label>
                <input
                  type="number"
                  min="1"
                  max="12"
                  required
                  value={cols}
                  onChange={(e) => setCols(Number(e.target.value))}
                  className="w-full bg-[#0F0F10] border border-[#2A2A2E] rounded-none p-2 text-white focus:outline-none focus:border-[#00F0FF]"
                />
              </div>
            </div>

            <div className="bg-[#0F0F10] p-4 border border-[#2A2A2E] rounded-none space-y-2 text-[10px] text-gray-400">
              <div className="flex items-center gap-1.5 text-[#00F0FF] font-bold uppercase">
                <LayoutGrid className="w-3.5 h-3.5" />
                AUTO-ALLOCATION SCHEME
              </div>
              <p>Venues automatically allocate:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>VIP Zone: Top 25% of rows</li>
                <li>Premium Zone: Next 35% of rows</li>
                <li>Standard Zone: Remaining rows</li>
              </ul>
              <p className="text-[#FFB300] font-bold">Once created, organisers can map events and admins can click seats in the live view to toggle categories!</p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#00F0FF] hover:bg-[#00D1E0] text-black font-bold py-2.5 rounded-none active:translate-y-0.5 transition-all uppercase border-0"
            >
              {isSubmitting ? 'Creating...' : 'Register Venue Structure'}
            </button>
          </form>
        </div>

        {/* Right Side: Venue Directory */}
        <div className="space-y-4">
          <h3 className="font-mono font-bold text-xs text-white flex items-center gap-2 uppercase tracking-wide">
            <Server className="w-4 h-4 text-[#00F0FF]" />
            CURRENT ACTIVE VENUES ({venues.length})
          </h3>

          {venues.length === 0 ? (
            <div className="py-12 border border-dashed border-[#2A2A2E] rounded-none text-center text-gray-500 font-mono text-xs bg-[#161618]">
              No venues registered. Initialize one on the left.
            </div>
          ) : (
            <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
              {venues.map((venue) => (
                <div key={venue.id} className="bg-[#161618] border border-[#2A2A2E] p-4 rounded-none flex justify-between items-center">
                  <div className="space-y-1">
                    <h4 className="font-mono font-bold text-xs text-white uppercase">{venue.name}</h4>
                    <p className="font-mono text-[9px] text-gray-500">
                      ID: {venue.id} • Grid: {venue.rows} Rows × {venue.cols} Columns • Total Seats: {venue.rows * venue.cols}
                    </p>
                  </div>
                  <div className="flex gap-1.5 font-mono text-[8px] font-bold">
                    <span className="bg-[#1C1625] text-purple-400 border border-purple-900/40 px-2 py-0.5 rounded-none">
                      {venue.layout.filter(l => l.category === 'VIP').length} VIP
                    </span>
                    <span className="bg-[#121A25] text-blue-400 border border-blue-900/40 px-2 py-0.5 rounded-none">
                      {venue.layout.filter(l => l.category === 'Premium').length} Prem
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
