import React, { useState, useRef, useEffect } from "react";
import { AppNotification } from "../types";
import { Bell, Check, Trash2, X, ClipboardList } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface NotificationsDropdownProps {
  notifications: AppNotification[];
  onDismiss: (id: string) => Promise<void>;
  onDismissAll?: () => Promise<void>;
}

export default function NotificationsDropdown({
  notifications,
  onDismiss,
  onDismissAll
}: NotificationsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadNotifications = notifications.filter(n => !n.read);
  const unreadCount = unreadNotifications.length;

  // Handle clicking outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* BELL / ACTIVITY BUTTON */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative bg-slate-50 hover:bg-slate-100 border border-slate-200 p-2.5 rounded-xl transition cursor-pointer flex items-center justify-center gap-2 shadow-xs group"
        id="activities-dropdown-trigger"
      >
        <Bell className="w-4 h-4 text-slate-600 group-hover:text-indigo-600 transition" />
        <span className="text-xs font-bold text-slate-700 hidden sm:inline">Recent Activities</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* DROPDOWN MENU */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden text-left"
          >
            {/* Header */}
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                  System Activities
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && onDismissAll && (
                  <button
                    onClick={async () => {
                      await onDismissAll();
                    }}
                    className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold uppercase transition cursor-pointer"
                  >
                    Clear All
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-slate-400 flex flex-col items-center gap-2">
                  <ClipboardList className="w-8 h-8 text-slate-300" />
                  <p className="text-xs font-medium">No recent activities logged.</p>
                </div>
              ) : (
                notifications.map(not => (
                  <div
                    key={not.id}
                    className={`p-4 flex items-start gap-3 transition-colors ${
                      not.read ? "bg-white opacity-70" : "bg-indigo-50/40"
                    }`}
                  >
                    <div className="mt-0.5">
                      <span className="text-[#0078d4]">ℹ️</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-700 leading-relaxed font-sans font-medium break-words">
                        {not.message}
                      </p>
                      <span className="text-[9px] text-slate-400 mt-1 block">
                        {new Date(not.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    {!not.read && (
                      <button
                        onClick={() => onDismiss(not.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-slate-100 transition flex-shrink-0 cursor-pointer"
                        title="Dismiss Activity"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
              <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">
                BillSlayer Secure Logging Suite
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
