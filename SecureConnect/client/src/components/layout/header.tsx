import { useState } from 'react';
import { Bell, BellOff, Moon, Sun, ChevronDown, LogOut, User, Palette } from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { AvatarStatus } from '@/components/ui/avatar-status';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface HeaderProps {
  onOpenProfile: () => void;
  onOpenThemeSettings: () => void;
}

export function Header({ onOpenProfile, onOpenThemeSettings }: HeaderProps) {
  const { user, logoutMutation } = useAuth();
  const { theme, setTheme, primaryColor } = useTheme();
  const { toast } = useToast();
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    user?.settings?.notificationsEnabled !== false
  );
  const [notificationsDialog, setNotificationsDialog] = useState(false);
  
  // Handle theme toggle
  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };
  
  // Handle notifications toggle
  const toggleNotifications = async () => {
    try {
      const newValue = !notificationsEnabled;
      setNotificationsEnabled(newValue);
      
      // Update user settings
      await apiRequest('PATCH', '/api/user/settings', {
        settings: {
          ...user?.settings,
          notificationsEnabled: newValue
        }
      });
      
      // Update local cache
      queryClient.setQueryData(['/api/user'], (oldData: any) => ({
        ...oldData,
        settings: {
          ...oldData.settings,
          notificationsEnabled: newValue
        }
      }));
      
      toast({
        title: `Notifications ${newValue ? 'enabled' : 'disabled'}`,
      });
      
      setNotificationsDialog(false);
    } catch (error) {
      toast({
        title: 'Failed to update notification settings',
        variant: 'destructive'
      });
    }
  };
  
  // Handle logout
  const handleLogout = () => {
    logoutMutation.mutate();
  };
  
  return (
    <header 
      className="px-4 py-2 text-white flex items-center justify-between shadow-md z-10"
      style={{ backgroundColor: primaryColor }}
    >
      <div className="flex items-center">
        <h1 className="text-xl font-semibold">RBLXC</h1>
        <span className="ml-2 text-xs bg-white bg-opacity-20 px-2 py-0.5 rounded-full">Beta</span>
      </div>
      
      <div className="flex items-center space-x-4">
        <Button
          size="icon"
          variant="ghost"
          className="p-1 rounded-full hover:bg-white hover:bg-opacity-10"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
        </Button>
        
        <Button
          size="icon"
          variant="ghost"
          className="p-1 rounded-full hover:bg-white hover:bg-opacity-10"
          onClick={() => setNotificationsDialog(true)}
          title={notificationsEnabled ? 'Disable Notifications' : 'Enable Notifications'}
        >
          {notificationsEnabled ? (
            <Bell className="h-5 w-5" />
          ) : (
            <BellOff className="h-5 w-5" />
          )}
        </Button>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost"
              className="flex items-center space-x-1 p-1 rounded-full hover:bg-white hover:bg-opacity-10"
            >
              {user && (
                <AvatarStatus
                  src={user.avatar}
                  alt={user.displayName}
                  size="sm"
                  status="online"
                  verified={user.isVerified}
                />
              )}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          
          <DropdownMenuContent align="end" className="w-56">
            <div className="p-3 border-b border-neutral-200">
              <div className="flex items-center">
                {user && (
                  <AvatarStatus
                    src={user.avatar}
                    alt={user.displayName}
                    verified={user.isVerified}
                    className="mr-3"
                  />
                )}
                <div>
                  <p className="font-medium">{user?.displayName}</p>
                  <p className="text-sm text-neutral-500">@{user?.username}</p>
                </div>
              </div>
            </div>
            
            <DropdownMenuItem onClick={onOpenProfile}>
              <User className="h-4 w-4 mr-2" />
              Profile
            </DropdownMenuItem>
            
            <DropdownMenuItem onClick={onOpenThemeSettings}>
              <Palette className="h-4 w-4 mr-2" />
              Customize Appearance
            </DropdownMenuItem>
            
            <DropdownMenuSeparator />
            
            <DropdownMenuItem 
              onClick={handleLogout}
              className="text-accent-red focus:text-accent-red"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      {/* Notifications Dialog */}
      <Dialog open={notificationsDialog} onOpenChange={setNotificationsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notification Settings</DialogTitle>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="notifications">Enable Notifications</Label>
                <p className="text-sm text-neutral-500">
                  Receive alerts for new messages and activities
                </p>
              </div>
              <Switch
                id="notifications"
                checked={notificationsEnabled}
                onCheckedChange={toggleNotifications}
              />
            </div>
            
            {notificationsEnabled && (
              <>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="sound">Sound</Label>
                    <p className="text-sm text-neutral-500">
                      Play sound for new notifications
                    </p>
                  </div>
                  <Switch id="sound" defaultChecked />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="preview">Message Preview</Label>
                    <p className="text-sm text-neutral-500">
                      Show message content in notifications
                    </p>
                  </div>
                  <Switch id="preview" defaultChecked />
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}
