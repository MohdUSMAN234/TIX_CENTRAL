/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Calendar, Clock, MapPin, Tag } from 'lucide-react';
import { EventListing } from '../types.js';

interface EventCardProps {
  key?: any;
  event: EventListing;
  isSelected: boolean;
  onSelect: () => void;
}

export default function EventCard({ event, isSelected, onSelect }: EventCardProps) {
  return (
    <div 
      onClick={onSelect}
      className={`bg-[#161618] border transition-all cursor-pointer flex flex-col justify-between ${
        isSelected 
          ? 'border-[#00F0FF] shadow-[0_0_15px_rgba(0,240,255,0.25)] bg-[#1A1A1C]' 
          : 'border-[#2A2A2E] hover:border-[#00F0FF] hover:bg-[#1A1A1C]'
      }`}
    >
      <div className="space-y-3 p-4">
        {/* Title & Tag */}
        <div className="space-y-1">
          <div className="flex justify-between items-start gap-2">
            <h3 className="font-mono font-bold text-sm text-white leading-tight tracking-tight uppercase">
              {event.title}
            </h3>
            <span className="font-mono text-[8px] bg-[#00F0FF] text-black px-1.5 py-0.5 rounded-none whitespace-nowrap uppercase tracking-widest font-black">
              ACTIVE
            </span>
          </div>
          <p className="font-mono text-[10px] text-[#A0A0AB] leading-normal line-clamp-2">
            {event.description}
          </p>
        </div>

        {/* Details List */}
        <div className="space-y-1.5 pt-2.5 border-t border-dashed border-[#2A2A2E] text-[11px] font-mono text-[#E0E0E0]">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-[#00F0FF]" />
            <span>{new Date(event.date).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-[#00F0FF]" />
            <span>{event.time} HRS</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-[#00F0FF]" />
            <span className="truncate max-w-[200px] text-[#A0A0AB]">{event.venueName}</span>
          </div>
        </div>
      </div>

      {/* Pricing Badges Footer */}
      <div className="mt-2 pt-3 pb-3 px-4 border-t border-[#2A2A2E] flex justify-between items-center gap-2 bg-[#121214]">
        <div className="flex gap-1">
          <span className="font-mono text-[9px] bg-[#161618] text-[#E0E0E0] px-1.5 py-0.5 border border-[#2A2A2E] font-bold">
            Std: ${event.pricing.Standard}
          </span>
          <span className="font-mono text-[9px] bg-[#00F0FF]/10 text-[#00F0FF] px-1.5 py-0.5 border border-[#00F0FF]/30 font-bold">
            Prem: ${event.pricing.Premium}
          </span>
        </div>

        <button 
          className={`font-mono text-[9px] font-bold px-2.5 py-1 transition-colors rounded-none uppercase ${
            isSelected 
              ? 'bg-[#00F0FF] text-black font-extrabold' 
              : 'bg-[#2A2A2E] text-[#E0E0E0] hover:bg-[#3E3E44]'
          }`}
        >
          {isSelected ? 'MAP LIVE' : 'OPEN MAP'}
        </button>
      </div>
    </div>
  );
}
