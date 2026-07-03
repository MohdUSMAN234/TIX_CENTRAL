/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Mail, ChevronDown, ChevronUp, Trash2, X, RefreshCw, Sparkles } from 'lucide-react';
import { EmailLog } from '../types.js';

export default function MailConsole() {
  const [isOpen, setIsOpen] = useState(false);
  const [emails, setEmails] = useState<EmailLog[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<EmailLog | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchEmails = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch('/api/emails');
      if (res.ok) {
        const data = await res.json();
        setEmails(data);
        if (data.length > 0 && !selectedEmail) {
          // auto select first one
          setSelectedEmail(data[0]);
        }
      }
    } catch (e) {
      console.error('Failed to fetch emails:', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  const clearEmails = async () => {
    try {
      const res = await fetch('/api/emails/clear', { method: 'POST' });
      if (res.ok) {
        setEmails([]);
        setSelectedEmail(null);
      }
    } catch (e) {
      console.error('Failed to clear emails:', e);
    }
  };

  // Poll for new emails every 3 seconds while open
  useEffect(() => {
    fetchEmails();
    const interval = setInterval(() => {
      fetchEmails();
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Floating Launcher Button */}
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-[#0F0F10] text-[#00F0FF] font-mono font-bold text-xs px-4 py-3 border border-[#00F0FF] rounded-none flex items-center gap-2 hover:bg-[#00F0FF]/10 transition-colors active:translate-y-0.5"
          id="mail-console-launcher"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-none bg-[#00F0FF] opacity-75"></span>
            <span className="relative inline-flex rounded-none h-2 w-2 bg-[#00F0FF]"></span>
          </span>
          <Mail className="w-4 h-4" />
          SYS-COMM MAIL TERMINAL
          <span className="bg-[#00F0FF]/20 text-[#00F0FF] px-1.5 py-0.5 rounded-none border border-[#00F0FF]/30 text-[9px]">
            {emails.length}
          </span>
        </button>
      ) : (
        /* Console Frame */
        <div className="bg-[#161618] border border-[#2A2A2E] rounded-none w-[360px] md:w-[680px] h-[480px] flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200">
          
          {/* Header Bar */}
          <div className="bg-[#0F0F10] text-white p-3 flex justify-between items-center border-b border-[#2A2A2E]">
            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="bg-[#00F0FF] w-2 h-2 rounded-none inline-block animate-pulse"></span>
              <span className="font-bold tracking-wider text-white uppercase">DEV MAIL SERVER: SIMULATOR</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={fetchEmails}
                disabled={isRefreshing}
                className="p-1 rounded-none hover:bg-[#161618] text-[#00F0FF] disabled:opacity-50"
                title="Force Refresh"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={clearEmails}
                className="p-1 rounded-none hover:bg-[#161618] text-red-400"
                title="Clear Logs"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-none hover:bg-[#161618] text-gray-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Double column contents (Split Screen) */}
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            
            {/* Left Hand: Email List Queue */}
            <div className="w-full md:w-1/3 border-b border-[#2A2A2E] md:border-b-0 md:border-r border-[#2A2A2E] overflow-y-auto bg-[#161618] flex flex-col">
              <div className="bg-[#0F0F10] p-2 font-mono text-[9px] font-bold text-gray-500 border-b border-[#2A2A2E] flex justify-between">
                <span>INCOMING LOGS</span>
                <span>FIFO STACK</span>
              </div>
              {emails.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
                  <Mail className="w-8 h-8 text-gray-700 mb-2" />
                  <p className="font-mono text-xs text-gray-500">Mailbox empty</p>
                  <p className="text-[10px] text-gray-600 mt-1 leading-normal">Book or cancel seats to dispatch alerts.</p>
                </div>
              ) : (
                <div className="divide-y divide-[#2A2A2E]">
                  {emails.map((email) => {
                    const isSelected = selectedEmail?.id === email.id;
                    const dateStr = new Date(email.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    
                    return (
                      <button
                        key={email.id}
                        onClick={() => setSelectedEmail(email)}
                        className={`w-full p-2.5 text-left font-mono transition-colors block border-l-2 ${
                          isSelected ? 'bg-[#00F0FF]/10 border-l-[#00F0FF]' : 'hover:bg-[#0F0F10]/50 border-l-transparent'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-1">
                          <span className="text-[9px] font-bold truncate text-white w-3/4">
                            To: {email.to.split('@')[0]}
                          </span>
                          <span className="text-[8px] text-gray-500 whitespace-nowrap">
                            {dateStr}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-300 truncate mt-0.5 font-bold">
                          {email.subject}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right Hand: Active Email Reader */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col bg-[#0F0F10]">
              {selectedEmail ? (
                <div className="flex-1 flex flex-col h-full">
                  {/* Metadata Header */}
                  <div className="border-b border-[#2A2A2E] border-dashed pb-3 mb-3 text-[10px] space-y-1 font-mono text-gray-400">
                    <div>
                      <span className="text-gray-500">DISPATCH: </span>
                      <span className="text-gray-300">{new Date(selectedEmail.timestamp).toLocaleString()}</span>
                    </div>
                    <div>
                      <strong className="text-gray-500 font-bold">RECIPIENT: </strong>
                      <span className="text-[#00F0FF] bg-[#00F0FF]/10 px-1.5 py-0.5 rounded-none border border-[#00F0FF]/20">{selectedEmail.to}</span>
                    </div>
                    <div>
                      <strong className="text-gray-500 font-bold">SUBJECT: </strong>
                      <span className="font-bold text-white uppercase">{selectedEmail.subject}</span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="flex-1 whitespace-pre-line font-mono text-[10px] text-gray-300 leading-relaxed bg-[#161618] p-3 rounded-none border border-[#2A2A2E] mb-4 overflow-y-auto max-h-[180px] md:max-h-[220px]">
                    {selectedEmail.body}
                  </div>

                  {/* Attachment Box (QR Code) */}
                  {selectedEmail.qrCode && (
                    <div className="bg-[#161618] border border-[#2A2A2E] p-3 rounded-none flex items-center justify-between gap-4 mt-auto">
                      <div className="space-y-1 font-mono">
                        <span className="text-[8px] bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/30 px-1.5 py-0.5 rounded-none font-bold">
                          ATTACHMENT
                        </span>
                        <p className="font-bold text-[10px] text-white">
                          digital_ticket_qrcode.png
                        </p>
                        <p className="text-[8px] text-gray-500">
                          Secure RSA Booking Validation Hash
                        </p>
                      </div>
                      <img 
                        src={selectedEmail.qrCode} 
                        alt="Booking Ticket QR Code" 
                        className="w-12 h-12 border border-[#2A2A2E] bg-white p-1"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                  <Sparkles className="w-8 h-8 text-gray-700 mb-3 animate-pulse" />
                  <p className="font-mono font-bold text-xs text-gray-500">No Email Selected</p>
                  <p className="font-mono text-[9px] text-gray-600 mt-1">Select an email log from the left index panel to view credentials.</p>
                </div>
              )}
            </div>

          </div>

          {/* Footer Bar */}
          <div className="bg-[#121214] px-4 py-2 border-t border-[#2A2A2E] font-mono text-[9px] text-gray-600 flex justify-between items-center">
            <span>STRICT LOCAL ISO TRANSACTION LOGS</span>
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-none bg-[#00F0FF]"></span>
              Active Listen: port 3000
            </span>
          </div>

        </div>
      )}
    </div>
  );
}
