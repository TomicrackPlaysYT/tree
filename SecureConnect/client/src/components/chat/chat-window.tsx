import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Info, Phone, Search, Video, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AvatarStatus } from "@/components/ui/avatar-status";
import { MessageItem } from "./message-item";
import { MessageInput } from "./message-input";
import { GroupChatMenu } from "./group-chat-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useWebSocket } from "@/hooks/use-websocket";
import { useChatContext } from "@/context/chat-context";
import { queryClient } from "@/lib/queryClient";
import { format } from "date-fns";

interface ChatWindowProps {
  chatId: number;
}

export function ChatWindow({ chatId }: ChatWindowProps) {
  const { user } = useAuth();
  const { selectedChat, setSelectedChat, refreshChats } = useChatContext();
  const { lastMessage, sendMessage } = useWebSocket();
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [typingUsers, setTypingUsers] = useState<number[]>([]);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<Record<number, NodeJS.Timeout>>({});
  const scrollListenerRef = useRef<(() => void) | null>(null);
  
  // Determine chat display information
  const chatName = selectedChat?.isGroup
    ? selectedChat?.name
    : selectedChat?.otherUser?.displayName;
  
  const chatAvatar = selectedChat?.isGroup
    ? selectedChat?.avatar
    : selectedChat?.otherUser?.avatar;
  
  const isOnline = !selectedChat?.isGroup && selectedChat?.otherUser?.isOnline;
  const isVerified = !selectedChat?.isGroup && selectedChat?.otherUser?.isVerified;
  
  // Get user status text
  const statusText = !selectedChat?.isGroup
    ? isOnline
      ? "Online"
      : selectedChat?.otherUser?.lastSeen
        ? `Last seen ${format(new Date(selectedChat.otherUser.lastSeen), "h:mm a")}`
        : "Offline"
    : `${selectedChat?.participants?.length || 0} members`;
  
  // Fetch messages
  const { data: messages, isLoading } = useQuery({
    queryKey: [`/api/chats/${chatId}/messages`],
    queryFn: async () => {
      console.log(`Fetching messages for chat ${chatId}`);
      const res = await fetch(`/api/chats/${chatId}/messages`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch messages");
      const data = await res.json();
      console.log(`Received ${data.length} messages for chat ${chatId}`);
      return data;
    },
    enabled: !!chatId,
    refetchOnWindowFocus: false,
    refetchInterval: 5000, // Poll every 5 seconds as a fallback
    staleTime: 2000 // Treat data as fresh for 2 seconds
  });
  
  // Handle incoming websocket messages
  useEffect(() => {
    if (!lastMessage) return;
    
    console.log("WebSocket message received:", lastMessage.type, lastMessage.payload);
    
    // Handle new messages
    if (lastMessage.type === 'new_message') {
      console.log('Received new message via WebSocket:', lastMessage.payload);
      
      // Always update the chat list to show the latest message, regardless of which chat we're in
      queryClient.invalidateQueries({ queryKey: ['/api/chats'] });
      
      // If we're in the chat that received the message, update the messages list
      if (lastMessage.payload.chatId === chatId) {
        queryClient.setQueryData([`/api/chats/${chatId}/messages`], (old: any) => {
          if (!old) return [lastMessage.payload];
          
          // Check if the message is already in the list (prevent duplicates)
          const messageExists = old.some((msg: any) => msg.id === lastMessage.payload.id);
          if (messageExists) {
            console.log('Message already exists in cache, not adding again');
            return old;
          }
          
          console.log('Adding new message to cache');
          
          // Add the new message and scroll to bottom
          const newMessages = [...old, lastMessage.payload];
          
          // Scroll to bottom for new messages after a short delay
          setTimeout(() => {
            scrollToBottom();
          }, 100);
          
          return newMessages;
        });
      }
    }
    
    // Handle message edits
    if (lastMessage.type === 'message_edited' && lastMessage.payload.chatId === chatId) {
      queryClient.setQueryData([`/api/chats/${chatId}/messages`], (old: any) => {
        if (!old) return [];
        return old.map((msg: any) => 
          msg.id === lastMessage.payload.id ? lastMessage.payload : msg
        );
      });
      
      // Also update chat list as the latest message might have been edited
      queryClient.invalidateQueries({ queryKey: ['/api/chats'] });
    }
    
    // Handle message deletions
    if (lastMessage.type === 'message_deleted') {
      queryClient.setQueryData([`/api/chats/${chatId}/messages`], (old: any) => {
        if (!old) return [];
        return old.map((msg: any) => 
          msg.id === lastMessage.payload.messageId 
            ? { ...msg, isDeleted: true, content: null, mediaUrl: null } 
            : msg
        );
      });
      
      // Also update chat list as the latest message might have been deleted
      queryClient.invalidateQueries({ queryKey: ['/api/chats'] });
    }
    
    // Handle typing indicators
    if (lastMessage.type === 'typing_indicator' && lastMessage.payload.chatId === chatId) {
      const typingUserId = lastMessage.payload.userId;
      
      // Clear existing timeout for this user if any
      if (typingTimeoutRef.current[typingUserId]) {
        clearTimeout(typingTimeoutRef.current[typingUserId]);
      }
      
      // Add user to typing users if not already there
      setTypingUsers(prev => {
        if (!prev.includes(typingUserId)) {
          return [...prev, typingUserId];
        }
        return prev;
      });
      
      // Set timeout to remove typing indicator after 3 seconds
      typingTimeoutRef.current[typingUserId] = setTimeout(() => {
        setTypingUsers(prev => prev.filter(id => id !== typingUserId));
      }, 3000);
    }
    
    // Handle reactions
    if (lastMessage.type === 'reaction_update') {
      queryClient.setQueryData([`/api/chats/${chatId}/messages`], (old: any) => {
        if (!old) return [];
        return old.map((msg: any) => 
          msg.id === lastMessage.payload.messageId 
            ? { ...msg, reactions: lastMessage.payload.reactions } 
            : msg
        );
      });
    }
    
    // Handle user status updates (online/offline)
    if (lastMessage.type === 'user_status' && selectedChat && !selectedChat.isGroup) {
      const { userId, isOnline } = lastMessage.payload;
      
      // If this status update is for the user we're chatting with
      if (selectedChat.otherUser && selectedChat.otherUser.id === userId) {
        // Update the chat to show the user's new status
        queryClient.setQueryData(['/api/chats'], (old: any) => {
          if (!old) return [];
          return old.map((chat: any) => {
            if (chat.id === chatId && chat.otherUser) {
              return {
                ...chat,
                otherUser: {
                  ...chat.otherUser,
                  isOnline,
                  lastSeen: isOnline ? chat.otherUser.lastSeen : new Date().toISOString()
                }
              };
            }
            return chat;
          });
        });
      }
    }
  }, [lastMessage, chatId, selectedChat]);
  
  // Scroll to bottom on initial load and chat change
  useEffect(() => {
    if (messages && messages.length > 0) {
      scrollToBottom();
    }
  }, [messages, chatId]);
  
  // Setup scroll listener
  useEffect(() => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;
    
    // Remove previous listener if exists
    if (scrollListenerRef.current) {
      const viewportEl = scrollArea.querySelector('[data-radix-scroll-area-viewport]');
      viewportEl?.removeEventListener('scroll', scrollListenerRef.current);
    }
    
    // Create and add new scroll listener
    const scrollListener = () => {
      const viewportEl = scrollArea.querySelector('[data-radix-scroll-area-viewport]');
      if (!viewportEl) return;
      
      const { scrollTop, scrollHeight, clientHeight } = viewportEl as HTMLElement;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      
      setShowScrollButton(!isNearBottom);
    };
    
    const viewportEl = scrollArea.querySelector('[data-radix-scroll-area-viewport]');
    viewportEl?.addEventListener('scroll', scrollListener);
    
    scrollListenerRef.current = scrollListener;
    
    return () => {
      viewportEl?.removeEventListener('scroll', scrollListener);
    };
  }, [scrollAreaRef.current]);
  
  // Cleanup typing timeouts
  useEffect(() => {
    return () => {
      Object.values(typingTimeoutRef.current).forEach(timeout => {
        clearTimeout(timeout);
      });
    };
  }, []);
  
  // Send typing indicator
  const sendTypingIndicator = () => {
    if (chatId) {
      sendMessage({
        type: 'typing',
        chatId: chatId
      });
    }
  };
  
  // Scroll to bottom function
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };
  
  // Group messages by date
  const groupedMessages = messages ? groupByDate(messages) : [];
  
  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Chat Header */}
      <div className="flex items-center justify-between p-3 bg-white border-b border-neutral-200">
        <div className="flex items-center">
          <AvatarStatus 
            src={chatAvatar || undefined}
            alt={chatName || "Chat"}
            status={selectedChat?.isGroup ? undefined : (isOnline ? "online" : "offline")}
            verified={isVerified}
          />
          <div className="ml-3">
            <h2 className="font-medium">{chatName}</h2>
            <p className="text-xs text-neutral-500">{statusText}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-1">
          <Button 
            size="icon" 
            variant="ghost" 
            className="h-9 w-9 rounded-full text-neutral-600"
            onClick={() => setShowSearch(!showSearch)}
          >
            <Search className="h-5 w-5" />
          </Button>
          <Button 
            size="icon" 
            variant="ghost" 
            className="h-9 w-9 rounded-full text-neutral-600"
          >
            <Phone className="h-5 w-5" />
          </Button>
          <Button 
            size="icon" 
            variant="ghost" 
            className="h-9 w-9 rounded-full text-neutral-600"
          >
            <Video className="h-5 w-5" />
          </Button>
          
          {selectedChat?.isGroup ? (
            <GroupChatMenu chatId={chatId} onLeaveGroup={() => {
              refreshChats();
              // Navigate to home or first chat
              queryClient.invalidateQueries({ queryKey: ['/api/chats'] });
              setSelectedChat(null);
            }} />
          ) : (
            <Button 
              size="icon" 
              variant="ghost" 
              className="h-9 w-9 rounded-full text-neutral-600"
            >
              <Info className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
      
      {/* Search Panel */}
      {showSearch && (
        <div className="bg-white border-b border-neutral-200 p-3">
          <div className="relative">
            <Input
              type="text"
              placeholder="Search messages..."
              className="pl-10 rounded-lg"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-500" />
          </div>
        </div>
      )}
      
      {/* Messages Area with Chat Background */}
      <div className="relative flex-1 overflow-hidden">
        <div className="absolute inset-0 bg-neutral-100">
          {/* Custom chat background would be applied here */}
        </div>
        
        <ScrollArea ref={scrollAreaRef} className="h-full relative z-10">
          <div className="p-4 relative min-h-full">
            {isLoading ? (
              <div className="flex justify-center items-center h-full">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce delay-75"></div>
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce delay-150"></div>
                </div>
              </div>
            ) : (
              <>
                {/* System Message - E2E Encryption */}
                <div className="flex justify-center my-4">
                  <span className="bg-neutral-100 text-neutral-600 text-xs py-1 px-3 rounded-lg">
                    End-to-end encrypted chat
                  </span>
                </div>
                
                {/* Group messages by date */}
                {groupedMessages.map((group) => (
                  <div key={group.date}>
                    {/* Date Divider */}
                    <div className="flex justify-center my-4">
                      <span className="bg-neutral-200 text-neutral-600 text-xs py-1 px-3 rounded-full">
                        {group.date}
                      </span>
                    </div>
                    
                    {/* Messages for this date */}
                    {group.messages.map((message) => (
                      <MessageItem 
                        key={message.id}
                        message={message}
                        isOwnMessage={message.senderId === user?.id}
                      />
                    ))}
                  </div>
                ))}
                
                {/* Typing indicator */}
                {typingUsers.length > 0 && (
                  <div className="flex mb-4">
                    <AvatarStatus 
                      src={chatAvatar || undefined}
                      alt={chatName || "Chat"}
                      size="sm"
                      className="self-end mr-2"
                    />
                    <div className="bg-white rounded-lg p-3 shadow-sm max-w-[65%]">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce delay-75"></div>
                        <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce delay-150"></div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Scroll anchor */}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>
        </ScrollArea>
        
        {/* Scroll to bottom button */}
        {showScrollButton && (
          <Button
            size="icon"
            className="absolute bottom-20 right-4 rounded-full shadow-md z-10 bg-white border border-neutral-200"
            onClick={scrollToBottom}
          >
            <ArrowDown className="h-4 w-4 text-neutral-600" />
          </Button>
        )}
      </div>
      
      {/* Message Input */}
      <MessageInput 
        chatId={chatId}
        onTyping={sendTypingIndicator}
      />
    </div>
  );
}

// Helper to group messages by date
function groupByDate(messages: any[]) {
  const groups: { date: string; messages: any[] }[] = [];
  let currentDate = '';
  
  messages.forEach(message => {
    const messageDate = new Date(message.createdAt);
    const dateStr = isToday(messageDate) 
      ? 'Today' 
      : isYesterday(messageDate) 
        ? 'Yesterday' 
        : format(messageDate, 'MMMM d, yyyy');
    
    if (dateStr !== currentDate) {
      currentDate = dateStr;
      groups.push({ date: dateStr, messages: [] });
    }
    
    groups[groups.length - 1].messages.push(message);
  });
  
  return groups;
}

function isToday(date: Date) {
  const today = new Date();
  return date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
}

function isYesterday(date: Date) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();
}
