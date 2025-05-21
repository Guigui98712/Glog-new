import { BellIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';
import { useNotifications } from '@/contexts/NotificationContext';

interface NotificationsIndicatorProps {
  className?: string;
  onClick?: () => void;
}

export function NotificationsIndicator({ className, onClick }: NotificationsIndicatorProps) {
  const { unreadCount, loading } = useNotifications();

  return (
    <button
      className={cn(
        "relative p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors", 
        className
      )}
      onClick={onClick}
      aria-label={`${unreadCount} notificações não lidas`}
    >
      <BellIcon className="h-6 w-6" />
      {unreadCount > 0 && !loading && (
        <span className="absolute top-0 right-0 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
} 