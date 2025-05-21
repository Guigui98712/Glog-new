import { NotificationsIndicator } from '@/components/ui/NotificationsIndicator';
import { NotificationsDialog } from '@/components/dialogs/NotificationsDialog';

export default function Header() {
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  <>
    <NotificationsIndicator onClick={() => setNotificationsOpen(true)} className="ml-2" />
    <NotificationsDialog open={notificationsOpen} onOpenChange={setNotificationsOpen} />
  </>
} 