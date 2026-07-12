"use client";

import { useEffect, useRef, useState } from "react";
import { BellIcon } from "@/components/icons";
import { api } from "@/lib/api";
import { useFetch } from "@/lib/use-fetch";
import { formatDistanceToNow } from "date-fns";

export function NotificationsPopover() {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Re-runs whenever `isOpen` flips (so opening the popover refreshes it) — loading/data are
  // derived during render by useFetch, not set from inside this effect.
  const { data, loading, reload } = useFetch(
    () => api.notifications.list({ page: 1, page_size: 10 }),
    [isOpen]
  );
  const notifications = data?.items ?? [];
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // Mark all as read
  const handleMarkAllRead = async () => {
    try {
      await api.notifications.markAllRead();
      reload();
    } catch (error) {
      console.error("Failed to mark notifications as read:", error);
    }
  };

  // Poll every 30 seconds — setInterval's own callback does the setState (via reload), not the
  // effect body itself, so this is the "subscribe to an external timer" pattern, not a
  // synchronous set-state-in-effect.
  useEffect(() => {
    const interval = setInterval(reload, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [isOpen]);

  return (
    <div className="notification-popover" ref={popoverRef}>
      <button
        className="icon-btn"
        aria-label="Notifications"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(v => !v);
        }}
      >
        <BellIcon />
        {unreadCount > 0 && <span className="dot" />}
      </button>

      {isOpen && (
        <div className="notification-dropdown">
          <div className="notification-header">
            <h3>Notifications</h3>
            {unreadCount > 0 && (
              <button
                style={{ color: "var(--color-primary)", cursor: "pointer" }}
                onClick={handleMarkAllRead}
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="notification-list">
            {loading && notifications.length === 0 ? (
              <div className="notification-empty">
                <p>Loading…</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="notification-empty">
                <p>No notifications yet</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`notification-item ${!notif.is_read ? "unread" : ""}`}
                >
                  {!notif.is_read && <span className="notification-dot" />}
                  <div className="notification-content">
                    <p className="notif-title">{notif.title}</p>
                    <p className="notif-message">{notif.message}</p>
                    <p className="notif-time">
                      {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
