import { useState, useEffect } from 'react';
import { UsersRound } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar';
import { ChatList } from '@/components/chat/chat-list';
import { ChatRequestList } from '@/components/chat/chat-request-list';
import { ChatWindow } from '@/components/chat/chat-window';
import { ThemeSettings } from '@/components/modals/theme-settings';
import { UserProfile } from '@/components/modals/user-profile';
import { useChatContext } from '@/context/chat-context';
import { useWebSocket } from '@/hooks/use-websocket';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { AvatarStatus } from '@/components/ui/avatar-status';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQuery } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

// Group chat form schema
const groupChatSchema = z.object({
  name: z.string().min(2, {
    message: "Group name must be at least 2 characters.",
  }),
  participants: z.array(z.number()).min(1, {
    message: "Select at least one participant.",
  }),
});

type GroupChatFormValues = z.infer<typeof groupChatSchema>;

export default function HomePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { connect, isConnected, sendMessage } = useWebSocket();
  const { selectedChat } = useChatContext();
  const [activeTab, setActiveTab] = useState('chats');
  const [themeSettingsOpen, setThemeSettingsOpen] = useState(false);
  const [userProfileOpen, setUserProfileOpen] = useState(false);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  
  // Connect to WebSocket when user is available - only once, using a ref to track initialization
  const [connectionInitialized, setConnectionInitialized] = useState(false);
  
  useEffect(() => {
    // Only attempt connection once during component lifecycle
    if (user && !connectionInitialized) {
      console.log("Home page: Initializing websocket connection (one-time)");
      setConnectionInitialized(true);
      // The connect() function now safely handles existing connections
      connect();
    }
  }, [user, connect, connectionInitialized]);
  
  // Fetch users for group chat creation
  const { data: users } = useQuery({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const res = await fetch('/api/users', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch users');
      return res.json();
    },
    enabled: createGroupOpen,
  });
  
  // Group chat form
  const form = useForm<GroupChatFormValues>({
    resolver: zodResolver(groupChatSchema),
    defaultValues: {
      name: '',
      participants: [],
    },
  });
  
  // Handle group chat creation
  const onSubmitGroupChat = async (values: GroupChatFormValues) => {
    try {
      // Create group chat
      const response = await fetch('/api/chats/group', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to create group chat');
      }
      
      toast({
        title: 'Group chat created',
        description: 'Your new group chat has been created successfully.',
      });
      
      // Reset form and close dialog
      form.reset();
      setCreateGroupOpen(false);
      
      // Switch to chats tab
      setActiveTab('chats');
    } catch (error) {
      toast({
        title: 'Failed to create group chat',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive',
      });
    }
  };
  
  return (
    <div className="h-screen flex flex-col bg-neutral-50">
      {/* Header */}
      <Header
        onOpenProfile={() => setUserProfileOpen(true)}
        onOpenThemeSettings={() => setThemeSettingsOpen(true)}
      />
      
      {/* Main Content */}
      <main className="flex flex-1 overflow-hidden">
        {/* Sidebar Navigation */}
        <Sidebar
          activeTab={activeTab}
          onChangeTab={setActiveTab}
          onCreateGroup={() => setCreateGroupOpen(true)}
          onOpenSettings={() => setThemeSettingsOpen(true)}
        />
        
        {/* Chat Lists or Settings based on active tab */}
        {activeTab === 'chats' && (
          <>
            <div className="flex flex-col w-72 border-r border-neutral-200 bg-white">
              <ChatRequestList />
              <ChatList />
            </div>
            
            {/* Chat Area */}
            {selectedChat ? (
              <ChatWindow chatId={selectedChat.id} />
            ) : (
              <div className="flex-1 flex items-center justify-center bg-neutral-100">
                <div className="text-center p-6 max-w-md">
                  <div className="mx-auto mb-4 bg-white w-16 h-16 rounded-full flex items-center justify-center shadow-sm">
                    <MessageSquare className="h-8 w-8 text-primary" />
                  </div>
                  <h2 className="text-xl font-semibold mb-2">No conversation selected</h2>
                  <p className="text-neutral-600 mb-4">
                    Select a chat from the list or start a new conversation
                  </p>
                </div>
              </div>
            )}
          </>
        )}
        
        {activeTab === 'requests' && (
          <div className="flex-1 flex flex-col">
            <div className="p-4 border-b border-neutral-200 bg-white">
              <h1 className="text-xl font-semibold">Chat Requests</h1>
              <p className="text-sm text-neutral-500">Manage your incoming chat requests</p>
            </div>
            
            <div className="flex-1 p-4 overflow-auto">
              <RequestsTab />
            </div>
          </div>
        )}
        
        {activeTab === 'groups' && (
          <div className="flex-1 flex flex-col">
            <div className="p-4 border-b border-neutral-200 bg-white">
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="text-xl font-semibold">Group Chats</h1>
                  <p className="text-sm text-neutral-500">Manage your group conversations</p>
                </div>
                <Button 
                  onClick={() => setCreateGroupOpen(true)}
                  className="flex items-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 h-4 w-4">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Create Group
                </Button>
              </div>
            </div>
            
            <div className="flex-1 p-4 overflow-auto">
              <GroupsTab />
            </div>
          </div>
        )}
        
        {activeTab === 'contacts' && (
          <div className="flex-1 flex flex-col">
            <div className="p-4 border-b border-neutral-200 bg-white">
              <h1 className="text-xl font-semibold">Contacts</h1>
              <p className="text-sm text-neutral-500">Manage your contacts and friends</p>
            </div>
            
            <div className="flex-1 p-4 overflow-auto">
              <ContactsTab />
            </div>
          </div>
        )}
      </main>
      
      {/* Modals */}
      <ThemeSettings
        open={themeSettingsOpen}
        onOpenChange={setThemeSettingsOpen}
      />
      
      <UserProfile
        open={userProfileOpen}
        onOpenChange={setUserProfileOpen}
      />
      
      {/* Create Group Chat Dialog */}
      <Dialog open={createGroupOpen} onOpenChange={setCreateGroupOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create Group Chat</DialogTitle>
            <DialogDescription>
              Create a new group and invite your friends to join.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmitGroupChat)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Group Name</FormLabel>
                    <FormControl>
                      <Input placeholder="My Awesome Group" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="participants"
                render={() => (
                  <FormItem>
                    <FormLabel>Select Participants</FormLabel>
                    <ScrollArea className="h-60 border rounded-md p-2">
                      {users ? (
                        users.map((user: any) => (
                          <FormField
                            key={user.id}
                            control={form.control}
                            name="participants"
                            render={({ field }) => {
                              return (
                                <FormItem
                                  key={user.id}
                                  className="flex flex-row items-center space-x-3 space-y-0 py-2"
                                >
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(user.id)}
                                      onCheckedChange={(checked) => {
                                        return checked
                                          ? field.onChange([...field.value, user.id])
                                          : field.onChange(
                                              field.value?.filter(
                                                (value) => value !== user.id
                                              )
                                            );
                                      }}
                                    />
                                  </FormControl>
                                  <div className="flex items-center space-x-2">
                                    <AvatarStatus
                                      src={user.avatar}
                                      alt={user.displayName}
                                      size="sm"
                                      verified={user.isVerified}
                                    />
                                    <div>
                                      <p className="text-sm font-medium">{user.displayName}</p>
                                      <p className="text-xs text-neutral-500">@{user.username}</p>
                                    </div>
                                  </div>
                                </FormItem>
                              );
                            }}
                          />
                        ))
                      ) : (
                        <div className="flex justify-center py-10">
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                            <div className="w-2 h-2 bg-primary rounded-full animate-bounce delay-75"></div>
                            <div className="w-2 h-2 bg-primary rounded-full animate-bounce delay-150"></div>
                          </div>
                        </div>
                      )}
                    </ScrollArea>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="flex justify-end space-x-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateGroupOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  Create Group
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Chat requests tab
function RequestsTab() {
  const { data: requests, isLoading } = useQuery({
    queryKey: ['/api/friend-requests'],
    queryFn: async () => {
      const res = await fetch('/api/friend-requests', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch friend requests');
      return res.json();
    }
  });
  
  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce delay-75"></div>
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce delay-150"></div>
        </div>
      </div>
    );
  }
  
  if (!requests || requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <UsersRound className="h-16 w-16 text-neutral-300 mb-4" />
        <h3 className="text-lg font-medium mb-1">No chat requests</h3>
        <p className="text-neutral-500 max-w-sm">
          When someone wants to chat with you, their request will appear here
        </p>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {requests.map((request: any) => (
        <ChatRequestItem key={request.id} request={request} />
      ))}
    </div>
  );
}

// Chat request item component
function ChatRequestItem({ request }: { request: any }) {
  return (
    <div className="bg-white rounded-lg p-4 shadow-sm flex items-center justify-between">
      <div className="flex items-center">
        <AvatarStatus
          src={request.sender?.avatar}
          alt={request.sender?.displayName || "User"}
          verified={request.sender?.isVerified}
        />
        <div className="ml-3">
          <h3 className="font-medium">{request.sender?.displayName}</h3>
          <p className="text-sm text-neutral-500">@{request.sender?.username}</p>
        </div>
      </div>
      <div className="flex space-x-2">
        <Button variant="outline" size="sm" className="text-accent-red">
          Decline
        </Button>
        <Button size="sm">Accept</Button>
      </div>
    </div>
  );
}

// Groups tab
function GroupsTab() {
  const { data: chats, isLoading } = useQuery({
    queryKey: ['/api/chats'],
    queryFn: async () => {
      const res = await fetch('/api/chats', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch chats');
      return res.json();
    }
  });
  
  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce delay-75"></div>
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce delay-150"></div>
        </div>
      </div>
    );
  }
  
  // Filter group chats
  const groupChats = chats?.filter((chat: any) => chat.isGroup) || [];
  
  if (groupChats.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <UsersRound className="h-16 w-16 text-neutral-300 mb-4" />
        <h3 className="text-lg font-medium mb-1">No group chats yet</h3>
        <p className="text-neutral-500 max-w-sm">
          Create a new group chat to start messaging with multiple friends at once
        </p>
      </div>
    );
  }
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {groupChats.map((chat: any) => (
        <div key={chat.id} className="bg-white rounded-lg p-4 shadow-sm">
          <div className="flex items-center mb-3">
            <AvatarStatus
              src={chat.avatar}
              alt={chat.name || "Group Chat"}
              size="lg"
            />
            <div className="ml-3">
              <h3 className="font-medium">{chat.name}</h3>
              <p className="text-sm text-neutral-500">
                {chat.participants?.length || 0} members
              </p>
            </div>
          </div>
          <div className="flex justify-end">
            <Button size="sm">Open Chat</Button>
          </div>
        </div>
      ))}
    </div>
  );
}

// Contacts tab
function ContactsTab() {
  const { data: friends, isLoading } = useQuery({
    queryKey: ['/api/friends'],
    queryFn: async () => {
      const res = await fetch('/api/friends', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch friends');
      return res.json();
    }
  });
  
  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce delay-75"></div>
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce delay-150"></div>
        </div>
      </div>
    );
  }
  
  if (!friends || friends.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <User className="h-16 w-16 text-neutral-300 mb-4" />
        <h3 className="text-lg font-medium mb-1">No contacts yet</h3>
        <p className="text-neutral-500 max-w-sm">
          Send chat requests to add friends to your contacts
        </p>
      </div>
    );
  }
  
  return (
    <div className="space-y-3">
      {friends.map((friend: any) => (
        <div key={friend.id} className="bg-white rounded-lg p-3 shadow-sm flex items-center justify-between">
          <div className="flex items-center">
            <AvatarStatus
              src={friend.user?.avatar}
              alt={friend.user?.displayName || "User"}
              status={friend.user?.isOnline ? "online" : "offline"}
              verified={friend.user?.isVerified}
            />
            <div className="ml-3">
              <h3 className="font-medium">{friend.user?.displayName}</h3>
              <p className="text-sm text-neutral-500">{friend.user?.status || "No status"}</p>
            </div>
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" size="sm">
              Block
            </Button>
            <Button size="sm">Message</Button>
          </div>
        </div>
      ))}
    </div>
  );
}

// Helper components
function MessageSquare({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>
  );
}

function User({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
      <circle cx="12" cy="7" r="4"></circle>
    </svg>
  );
}
