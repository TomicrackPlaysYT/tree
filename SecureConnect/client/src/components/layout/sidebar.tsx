import { useState } from 'react';
import { MessageSquare, User, UserPlus, UsersRound, Settings, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useChatContext } from '@/context/chat-context';
import { useTheme } from '@/hooks/use-theme';

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  badge?: number;
  onClick: () => void;
}

function SidebarItem({ icon, label, active, badge, onClick }: SidebarItemProps) {
  const { primaryColor } = useTheme();
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={active ? "default" : "ghost"}
            size="icon"
            className={`relative rounded-full h-10 w-10 ${
              active 
                ? "bg-primary-light text-primary"
                : "text-neutral-600 hover:bg-neutral-100"
            }`}
            onClick={onClick}
            style={active ? { color: primaryColor } : {}}
          >
            {icon}
            {badge && badge > 0 && (
              <span className="absolute -top-1 -right-1 bg-accent text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {badge > 9 ? '9+' : badge}
              </span>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p>{label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface Props {
  activeTab: string;
  onChangeTab: (tab: string) => void;
  onCreateGroup: () => void;
  onOpenSettings: () => void;
}

export function Sidebar({ activeTab, onChangeTab, onCreateGroup, onOpenSettings }: Props) {
  const { user } = useAuth();
  
  // Fetch friend requests count
  const { data: friendRequests } = useQuery({
    queryKey: ['/api/friend-requests'],
    queryFn: async () => {
      const res = await fetch('/api/friend-requests', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch friend requests');
      return res.json();
    }
  });
  
  // Get request count
  const requestCount = friendRequests?.length || 0;
  
  return (
    <aside className="w-16 bg-white border-r border-neutral-200 flex flex-col items-center py-4 shadow-sm">
      <Button 
        size="icon"
        className="p-2 rounded-full bg-primary text-white mb-6"
        onClick={() => onChangeTab('chats')}
      >
        <MessageSquare className="h-5 w-5" />
      </Button>
      
      <nav className="flex flex-col items-center space-y-4">
        <SidebarItem
          icon={<MessageSquare className="h-5 w-5" />}
          label="Chats"
          active={activeTab === 'chats'}
          onClick={() => onChangeTab('chats')}
        />
        
        <SidebarItem
          icon={<UserPlus className="h-5 w-5" />}
          label="Chat Requests"
          active={activeTab === 'requests'}
          badge={requestCount}
          onClick={() => onChangeTab('requests')}
        />
        
        <SidebarItem
          icon={<UsersRound className="h-5 w-5" />}
          label="Group Chats"
          active={activeTab === 'groups'}
          onClick={() => onChangeTab('groups')}
        />
        
        <SidebarItem
          icon={<User className="h-5 w-5" />}
          label="Contacts"
          active={activeTab === 'contacts'}
          onClick={() => onChangeTab('contacts')}
        />
        
        <SidebarItem
          icon={<PlusCircle className="h-5 w-5" />}
          label="Create Group"
          onClick={onCreateGroup}
        />
      </nav>
      
      <div className="mt-auto">
        <SidebarItem
          icon={<Settings className="h-5 w-5" />}
          label="Settings"
          onClick={onOpenSettings}
        />
      </div>
    </aside>
  );
}
