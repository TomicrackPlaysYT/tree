import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AvatarStatus } from "@/components/ui/avatar-status";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/use-websocket";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useChatContext } from "@/context/chat-context";
import { formatDistanceToNow } from "date-fns";

type ChatItemProps = {
  id: number;
  name?: string | null;
  avatar?: string | null;
  isGroup: boolean;
  otherUser?: {
    id: number;
    username: string;
    displayName: string;
    avatar?: string | null;
    isOnline: boolean;
    lastSeen: string;
    isVerified: boolean;
  };
  lastMessage?: {
    content: string | null;
    type: string;
    createdAt: string;
    senderId: number;
  };
  isActive: boolean;
  onClick: () => void;
};

function ChatItem({
  name,
  avatar,
  isGroup,
  otherUser,
  lastMessage,
  isActive,
  onClick
}: ChatItemProps) {
  const timeSince = lastMessage?.createdAt
    ? formatDistanceToNow(new Date(lastMessage.createdAt), { addSuffix: false })
    : "";

  // Format time (e.g., 2h, 5m)
  const formattedTime = timeSince
    .replace(" minutes", "m")
    .replace(" minute", "m")
    .replace(" hours", "h")
    .replace(" hour", "h")
    .replace(" days", "d")
    .replace(" day", "d")
    .replace("about ", "")
    .replace("less than a minute", "now");

  // Get display name and avatar
  const displayName = isGroup 
    ? name 
    : otherUser?.displayName || "Unknown User";
  
  // Process the avatar url to handle data URLs correctly
  let displayAvatar = isGroup
    ? avatar
    : otherUser?.avatar;
    
  // Ensure we have a unique timestamp for data URLs to prevent caching
  if (displayAvatar && displayAvatar.startsWith('data:image/') && !displayAvatar.includes('#')) {
    displayAvatar = `${displayAvatar}#t=${Date.now()}`;
  }

  // Determine online status
  const status = otherUser?.isOnline 
    ? "online" 
    : "offline";

  return (
    <div 
      onClick={onClick}
      className={`flex items-center p-3 cursor-pointer border-b border-neutral-100 transition-colors ${
        isActive ? "bg-primary-light" : "hover:bg-neutral-50"
      }`}
    >
      <AvatarStatus 
        src={displayAvatar || undefined}
        alt={displayName}
        status={isGroup ? undefined : status}
        verified={otherUser?.isVerified}
        size="lg"
      />
      
      <div className="ml-3 flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <h3 className="font-medium text-sm truncate">{displayName}</h3>
          </div>
          <span className="text-xs text-neutral-500">{formattedTime}</span>
        </div>
        
        {lastMessage && (
          <div className="flex items-center">
            {lastMessage.type !== "text" && (
              <span className="mr-1 text-neutral-400">
                {lastMessage.type === "image" && <span className="material-icons text-xs">photo</span>}
                {lastMessage.type === "audio" && <span className="material-icons text-xs">mic</span>}
                {lastMessage.type === "video" && <span className="material-icons text-xs">videocam</span>}
                {lastMessage.type === "document" && <span className="material-icons text-xs">insert_drive_file</span>}
              </span>
            )}
            <p className="text-sm text-neutral-600 truncate">
              {lastMessage.content || `[${lastMessage.type}]`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function ChatList() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const { lastMessage } = useWebSocket();
  const { selectedChat, setSelectedChat } = useChatContext();
  
  // Fetch all chats
  const { data: chats, isLoading } = useQuery({
    queryKey: ["/api/chats"],
    queryFn: async () => {
      const res = await fetch("/api/chats", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch chats");
      return res.json();
    }
  });
  
  // Fetch all users for new chat dialog
  const { data: users } = useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await fetch("/api/users", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
    enabled: showNewChatDialog
  });
  
  // Update chat list when receiving new messages (avoid setting useWebSocket() hooks in multiple components)
  useEffect(() => {
    if (lastMessage && 
       (lastMessage.type === 'new_message' || 
        lastMessage.type === 'new_chat')) {
      queryClient.invalidateQueries({ queryKey: ['/api/chats'] });
    }
  }, [lastMessage]);
  
  // Filter chats by search term
  const filteredChats = chats 
    ? chats.filter(chat => {
        const name = chat.name || chat.otherUser?.displayName || "";
        return name.toLowerCase().includes(searchTerm.toLowerCase());
      })
    : [];
  
  // Create a new chat or send friend request
  const startNewChat = async (userId: number) => {
    try {
      // Send friend request first
      await apiRequest("POST", "/api/friend-request", { friendId: userId });
      
      toast({
        title: "Chat request sent",
        description: "The user must accept your request before you can start chatting."
      });
      
      setShowNewChatDialog(false);
    } catch (error) {
      toast({
        title: "Failed to send chat request",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="w-72 border-r border-neutral-200 bg-white flex flex-col h-full">
      <div className="p-3 border-b border-neutral-200">
        <div className="relative">
          <Input
            type="text"
            placeholder="Search chats..."
            className="pl-10 rounded-full bg-neutral-100"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
        </div>
      </div>
      
      <div className="px-3 py-2 flex justify-between items-center">
        <h2 className="font-medium text-sm text-neutral-600">Recent Chats</h2>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-primary text-sm font-medium"
          onClick={() => setShowNewChatDialog(true)}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          New Chat
        </Button>
      </div>
      
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex justify-center py-10">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce delay-75"></div>
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce delay-150"></div>
            </div>
          </div>
        ) : filteredChats.length > 0 ? (
          filteredChats.map((chat) => (
            <ChatItem
              key={chat.id}
              id={chat.id}
              name={chat.name}
              avatar={chat.avatar}
              isGroup={chat.isGroup}
              otherUser={chat.otherUser}
              lastMessage={chat.lastMessage}
              isActive={selectedChat?.id === chat.id}
              onClick={() => setSelectedChat(chat)}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <span className="material-icons text-neutral-400 text-4xl mb-2">chat_bubble_outline</span>
            <p className="text-neutral-500 text-sm">No chats found</p>
            {searchTerm ? (
              <p className="text-neutral-400 text-xs mt-1">Try a different search term</p>
            ) : (
              <Button
                variant="link"
                size="sm"
                className="mt-2 text-primary"
                onClick={() => setShowNewChatDialog(true)}
              >
                Start a new conversation
              </Button>
            )}
          </div>
        )}
      </ScrollArea>
      
      <Dialog open={showNewChatDialog} onOpenChange={setShowNewChatDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Conversation</DialogTitle>
            <DialogDescription>
              Send a chat request to start a new conversation
            </DialogDescription>
          </DialogHeader>
          
          <div className="relative mb-4">
            <Input
              type="text"
              placeholder="Search users..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
          </div>
          
          <ScrollArea className="h-60">
            {users ? (
              users
                .filter(user => 
                  user.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  user.username.toLowerCase().includes(searchTerm.toLowerCase())
                )
                .map(user => (
                  <div 
                    key={user.id}
                    className="flex items-center p-3 hover:bg-neutral-50 rounded-md cursor-pointer"
                    onClick={() => startNewChat(user.id)}
                  >
                    <AvatarStatus 
                      src={user.avatar && 
                           user.avatar.startsWith('data:image/') && 
                           !user.avatar.includes('#') 
                           ? `${user.avatar}#t=${Date.now()}` 
                           : user.avatar}
                      alt={user.displayName}
                      status={user.isOnline ? "online" : "offline"}
                      verified={user.isVerified}
                    />
                    <div className="ml-3">
                      <p className="font-medium text-sm">{user.displayName}</p>
                      <p className="text-xs text-neutral-500">@{user.username}</p>
                    </div>
                  </div>
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
        </DialogContent>
      </Dialog>
    </div>
  );
}
