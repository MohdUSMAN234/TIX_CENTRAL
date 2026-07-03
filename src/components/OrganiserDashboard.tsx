/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { PlusCircle, BarChart3, TrendingUp, Users, Calendar, Clock, DollarSign, Award } from 'lucide-react';
import { Venue, EventListing, EventPricing } from '../types.js';

interface OrganiserDashboardProps {
  onEventCreated: () => void;
  currentUserEmail: string;
  currentUserId: string;
}

export default function OrganiserDashboard({ onEventCreated, currentUserEmail, currentUserId }: OrganiserDashboardProps) {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [events, setEvents] = useState<EventListing[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [report, setReport] = useState<any | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [venueId, setVenueId] = useState('');
  const [pricing, setPricing] = useState<EventPricing>({ Standard: 30, Premium: 60, VIP: 100 });
  
  const [msg, setMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      const resVenues = await fetch('/api/venues');
      if (resVenues.ok) {
        setVenues(await resVenues.json());
      }
      const resEvents = await fetch('/api/events');
      if (resEvents.ok) {
        const allEvents = await resEvents.json();
        // filter events by organiser id
        const myEvents = allEvents.filter((e: any) => e.organiserId === currentUserId);
        setEvents(myEvents);
        if (myEvents.length > 0 && !selectedEventId) {
          setSelectedEventId(myEvents[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Fetch report whenever active selected event changes
  useEffect(() => {
    if (selectedEventId) {
      fetch(`/api/events/${selectedEventId}/reports`, {
        headers: {
          'x-user-role': 'organiser',
          'x-user-id': currentUserId
        }
      })
        .then(res => res.json())
        .then(data => {
          if (!data.error) {
            setReport(data);
          }
        });
    }
  }, [selectedEventId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !date || !time || !venueId) return;
    setIsSubmitting(true);
    setMsg('');

    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'organiser',
          'x-user-id': currentUserId
        },
        body: JSON.stringify({
          title,
          description,
          date,
          time,
          venueId,
          pricing
        })
      });

      if (res.ok) {
        setMsg('Show listed successfully!');
        setTitle('');
        setDescription('');
        setDate('');
        setTime('');
        fetchData();
        onEventCreated();
      } else {
        const data = await res.json();
        setMsg(data.error || 'Failed to list event.');
      }
    } catch (e) {
      console.error(e);
      setMsg('Network listing error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-[#2A2A2E] pb-2">
        <span className="font-mono text-[10px] text-[#00F0FF] font-bold uppercase block tracking-wider">[PORTAL_LOGS] CONCURRENT DISPATCH LOG</span>
        <h2 className="font-mono font-black text-lg text-white tracking-tight mt-0.5 uppercase">ORGANISER WORKSPACE</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Column 1: Create Show Form */}
        <div className="bg-[#161618] border border-[#2A2A2E] p-5 rounded-none h-fit">
          <h3 className="font-mono font-bold text-xs text-white mb-4 flex items-center gap-2 uppercase tracking-wide">
            <PlusCircle className="w-4 h-4 text-[#00F0FF]" />
            SCHEDULE NEW SHOW
          </h3>

          {msg && (
            <div className="mb-4 p-2.5 rounded-none bg-[#00F0FF]/10 border border-[#00F0FF]/30 font-mono text-[10px] text-[#00F0FF]">
              {msg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 font-mono text-xs text-[#E0E0E0]">
            <div className="space-y-1">
              <label className="block text-gray-400 font-bold uppercase">SHOW / CONCERT TITLE</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="The Symphony Orchestra: Moonlight Sonata"
                className="w-full bg-[#0F0F10] border border-[#2A2A2E] rounded-none p-2 text-white placeholder-gray-700 focus:outline-none focus:border-[#00F0FF]"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-gray-400 font-bold uppercase">SHORT DESCRIPTION</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A classical remastering under the moonlight..."
                className="w-full bg-[#0F0F10] border border-[#2A2A2E] rounded-none p-2 text-white placeholder-gray-700 h-16 focus:outline-none focus:border-[#00F0FF]"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-gray-400 font-bold uppercase">TARGET AUDITORIUM / VENUE</label>
              <select
                required
                value={venueId}
                onChange={(e) => setVenueId(e.target.value)}
                className="w-full bg-[#0F0F10] border border-[#2A2A2E] rounded-none p-2 text-white focus:outline-none focus:border-[#00F0FF]"
              >
                <option value="">-- Choose Venue Layout --</option>
                {venues.map((v) => (
                  <option key={v.id} value={v.id}>{v.name} ({v.rows * v.cols} seats)</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-gray-400 font-bold uppercase">DATE (YYYY-MM-DD)</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-[#0F0F10] border border-[#2A2A2E] rounded-none p-2 text-white focus:outline-none focus:border-[#00F0FF]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-gray-400 font-bold uppercase">TIME (HH:MM)</label>
                <input
                  type="time"
                  required
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full bg-[#0F0F10] border border-[#2A2A2E] rounded-none p-2 text-white focus:outline-none focus:border-[#00F0FF]"
                />
              </div>
            </div>

            {/* Pricing Section */}
            <div className="border-t border-dashed border-[#2A2A2E] pt-3 space-y-2">
              <span className="block text-gray-400 font-bold uppercase tracking-wider text-[9px]">Tier Pricing Setup ($)</span>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="block text-[9px] text-gray-500 uppercase">Standard</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={pricing.Standard}
                    onChange={(e) => setPricing({ ...pricing, Standard: Number(e.target.value) })}
                    className="w-full bg-[#0F0F10] border border-[#2A2A2E] rounded-none p-1.5 text-white text-center focus:outline-none focus:border-[#00F0FF]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[9px] text-gray-500 uppercase">Premium</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={pricing.Premium}
                    onChange={(e) => setPricing({ ...pricing, Premium: Number(e.target.value) })}
                    className="w-full bg-[#0F0F10] border border-[#2A2A2E] rounded-none p-1.5 text-white text-center focus:outline-none focus:border-[#00F0FF]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[9px] text-gray-500 uppercase">VIP</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={pricing.VIP}
                    onChange={(e) => setPricing({ ...pricing, VIP: Number(e.target.value) })}
                    className="w-full bg-[#0F0F10] border border-[#2A2A2E] rounded-none p-1.5 text-white text-center focus:outline-none focus:border-[#00F0FF]"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#00F0FF] hover:bg-[#00D1E0] text-black font-bold py-2.5 rounded-none active:translate-y-0.5 transition-all uppercase border-0"
            >
              {isSubmitting ? 'Submitting...' : 'Register Event Listing'}
            </button>
          </form>
        </div>

        {/* Column 2 & 3: Reports section */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Select Show for Report */}
          <div className="bg-[#161618] border border-[#2A2A2E] p-4 rounded-none flex flex-col md:flex-row gap-4 justify-between items-center">
            <div>
              <h3 className="font-mono font-bold text-xs text-white flex items-center gap-1.5 uppercase">
                <BarChart3 className="w-4 h-4 text-[#00F0FF]" />
                CHOOSE RUNNING SHOW FOR LIVE REVENUE
              </h3>
              <p className="font-mono text-[10px] text-gray-500">Reports pull dynamically from seat allocations.</p>
            </div>
            
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="bg-[#0F0F10] border border-[#2A2A2E] rounded-none p-2 font-mono text-xs text-white w-full md:w-[240px] focus:outline-none focus:border-[#00F0FF]"
            >
              <option value="">-- Choose Show --</option>
              {events.map(e => (
                <option key={e.id} value={e.id}>{e.title}</option>
              ))}
            </select>
          </div>

          {/* Report Data display */}
          {report ? (
            <div className="space-y-6">
              
              {/* Stat Cards Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                
                <div className="bg-[#161618] border border-[#2A2A2E] p-4 rounded-none text-center">
                  <div className="flex justify-center mb-1 text-[#00F0FF]">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <span className="font-mono text-[9px] text-gray-500 uppercase font-bold">Revenue</span>
                  <p className="font-mono font-black text-base text-white mt-1">${report.totalRevenue.toFixed(2)}</p>
                </div>

                <div className="bg-[#161618] border border-[#2A2A2E] p-4 rounded-none text-center">
                  <div className="flex justify-center mb-1 text-[#00F0FF]">
                    <Users className="w-5 h-5" />
                  </div>
                  <span className="font-mono text-[9px] text-gray-500 uppercase font-bold">Fill Rate</span>
                  <p className="font-mono font-black text-base text-white mt-1">{report.fillRate}%</p>
                </div>

                <div className="bg-[#161618] border border-[#2A2A2E] p-4 rounded-none text-center">
                  <div className="flex justify-center mb-1 text-green-400">
                    <Award className="w-5 h-5" />
                  </div>
                  <span className="font-mono text-[9px] text-gray-500 uppercase font-bold">Booked Seats</span>
                  <p className="font-mono font-black text-base text-white mt-1">
                    {report.bookedSeats} <span className="text-gray-500 text-xs">/ {report.totalSeats}</span>
                  </p>
                </div>

                <div className="bg-[#161618] border border-[#2A2A2E] p-4 rounded-none text-center">
                  <div className="flex justify-center mb-1 text-[#FFB300]">
                    <Clock className="w-5 h-5" />
                  </div>
                  <span className="font-mono text-[9px] text-gray-500 uppercase font-bold">Waitlisted</span>
                  <p className="font-mono font-black text-base text-white mt-1">{report.waitlistCount} users</p>
                </div>

              </div>

              {/* Tier Metrics Breakdown Table */}
              <div className="bg-[#161618] border border-[#2A2A2E] rounded-none p-5">
                <h4 className="font-mono font-bold text-xs text-white mb-4 border-b border-[#2A2A2E] pb-2 uppercase tracking-wider">
                  CATEGORY REVENUE BREAKDOWN
                </h4>

                <div className="overflow-x-auto">
                  <table className="w-full font-mono text-xs text-left">
                    <thead>
                      <tr className="bg-[#0F0F10] border-b border-[#2A2A2E] text-gray-400 font-bold">
                        <th className="p-2.5 uppercase">CATEGORY</th>
                        <th className="p-2.5 text-center uppercase">SALES CAPACITY</th>
                        <th className="p-2.5 text-center uppercase">BOOKED COUNT</th>
                        <th className="p-2.5 text-right uppercase">TOTAL EARNINGS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2A2A2E]">
                      {Object.entries(report.categoryStats).map(([category, stats]: [string, any]) => (
                        <tr key={category} className="hover:bg-[#0F0F10]/40">
                          <td className="p-2.5 font-bold text-white">{category}</td>
                          <td className="p-2.5 text-center text-gray-300">
                            {stats.total > 0 ? ((stats.booked / stats.total) * 100).toFixed(0) : 0}%
                          </td>
                          <td className="p-2.5 text-center text-gray-400">
                            {stats.booked} <span className="text-gray-700">/</span> {stats.total}
                          </td>
                          <td className="p-2.5 text-right font-black text-[#00F0FF]">
                            ${stats.revenue.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          ) : (
            <div className="py-24 border border-dashed border-[#2A2A2E] rounded-none text-center text-gray-500 font-mono text-xs bg-[#161618]">
              No reports selected or available. Create a show on the left to start tracing analytics.
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
