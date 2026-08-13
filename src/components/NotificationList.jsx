const TYPE_ICONS = {
  new_offer: "↓",
  offer_accepted: "✓",
  offer_declined: "—",
  offer_withdrawn: "↩",
  trade_completed: "✦",
};

function formatNotificationTime(timestamp) {
  if (!timestamp) return "Just now";

  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000));
  if (elapsedSeconds < 60) return "Just now";
  if (elapsedSeconds < 3600) return `${Math.floor(elapsedSeconds / 60)}m ago`;
  if (elapsedSeconds < 86400) return `${Math.floor(elapsedSeconds / 3600)}h ago`;

  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(timestamp));
}

function NotificationList({ emptyCopy, notifications, onOpen }) {
  if (!notifications.length) {
    return <p className="notification-empty">{emptyCopy}</p>;
  }

  return (
    <div className="notification-list">
      {notifications.map((notification) => (
        <button
          className={`notification-entry${notification.read_at ? "" : " unread"}`}
          key={notification.id}
          onClick={() => onOpen(notification)}
          type="button"
        >
          <span className={`notification-icon notification-icon-${notification.type}`} aria-hidden="true">{TYPE_ICONS[notification.type] || "•"}</span>
          <span className="notification-copy">
            <strong>{notification.title}</strong>
            <span>{notification.body}</span>
          </span>
          <time dateTime={notification.created_at}>{formatNotificationTime(notification.created_at)}</time>
          {!notification.read_at && <span className="notification-unread-dot" aria-label="Unread" />}
        </button>
      ))}
    </div>
  );
}

export default NotificationList;
