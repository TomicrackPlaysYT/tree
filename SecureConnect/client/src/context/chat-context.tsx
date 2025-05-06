import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useWebSocket } from '@/hooks/use-websocket';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

// Chat participant type
interface ChatParticipant {
  id: number;
  userId: number;
  chatId: number;
  role: string;
  status: string;
  joinedAt: string;
}

// Message type for the context
interface Message {
  id: number;
  chatId: number;
  senderId: number;
  content: string | null;
  type: string;
  mediaUrl: string | null;
  replyToId: number | null;
  isEdited: boolean;
  isDeleted: boolean;
  reactions: Record<string, number[]>;
  createdAt: string;
  sender?: {
    id: number;
    username: string;
    displayName: string;
    avatar?: string | null;
    isOnline: boolean;
    lastSeen: string;
    isVerified: boolean;
  };
  replyTo?: Message | null;
}

// Chat type for the context
interface Chat {
  id: number;
  name: string | null;
  isGroup: boolean;
  avatar: string | null;
  createdById: number;
  createdAt: string;
  otherUser?: {
    id: number;
    username: string;
    displayName: string;
    avatar?: string | null;
    isOnline: boolean;
    lastSeen: string;
    isVerified: boolean;
    status?: string;
  };
  lastMessage?: {
    id: number;
    content: string | null;
    senderId: number;
    type: string;
    createdAt: string;
  };
  participants?: ChatParticipant[];
}

// Chat context type
interface ChatContextType {
  selectedChat: Chat | null;
  setSelectedChat: (chat: Chat | null) => void;
  createGroupChat: (name: string, participants: number[]) => Promise<void>;
  acceptGroupInvitation: (chatId: number) => Promise<void>;
  rejectGroupInvitation: (chatId: number) => Promise<void>;
  leaveGroupChat: (chatId: number) => Promise<void>;
  refreshChats: () => void;
  refreshMessages: (chatId: number) => void;
}

// Create context
const ChatContext = createContext<ChatContextType | undefined>(undefined);

// Provider component
export const ChatProvider = ({ children }: { children: ReactNode }) => {
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const { lastMessage, isConnected } = useWebSocket();
  const { toast } = useToast();

  // Handle real-time updates from WebSocket messages
  useEffect(() => {
    if (!lastMessage) return;

    console.log('WebSocket message received:', lastMessage);

    // Handle different types of WebSocket messages
    switch (lastMessage.type) {
      case 'new_message':
        // Update the messages in the chat if it matches the currently selected chat
        if (selectedChat && lastMessage.payload.chatId === selectedChat.id) {
          queryClient.invalidateQueries({ 
            queryKey: [`/api/chats/${lastMessage.payload.chatId}/messages`] 
          });
          
          // Also update the chats list to show the latest message
          queryClient.invalidateQueries({ queryKey: ['/api/chats'] });
        } else {
          // Show a notification for messages in other chats
          const senderName = lastMessage.payload.sender?.displayName || 'Someone';
          const chatName = lastMessage.payload.chatId ? `Chat #${lastMessage.payload.chatId}` : 'a chat';
          
          toast({
            title: `New message from ${senderName}`,
            description: lastMessage.payload.content || 'New message received',
            duration: 5000,
          });
          
          // Still update the chats list to show the latest message
          queryClient.invalidateQueries({ queryKey: ['/api/chats'] });
        }
        break;
        
      case 'message_edited':
        // Update the messages if it's in the current chat
        if (selectedChat && lastMessage.payload.chatId === selectedChat.id) {
          queryClient.invalidateQueries({ 
            queryKey: [`/api/chats/${lastMessage.payload.chatId}/messages`] 
          });
        }
        break;
        
      case 'message_deleted':
        // Update the messages if it's in the current chat
        if (selectedChat) {
          queryClient.invalidateQueries({ 
            queryKey: [`/api/chats/${selectedChat.id}/messages`] 
          });
        }
        break;
        
      case 'profile_update':
        // When a user updates their profile (avatar, display name, etc.)
        console.log('Profile update received:', lastMessage.payload);
        
        // If the updated user is part of the selected chat, update the chat
        if (selectedChat) {
          // For direct chats, update if the other user changed their profile
          if (!selectedChat.isGroup && selectedChat.otherUser?.id === lastMessage.payload.userId) {
            // Update the selected chat with the new avatar and display name
            setSelectedChat(prev => {
              if (!prev || !prev.otherUser) return prev;
              
              return {
                ...prev,
                otherUser: {
                  ...prev.otherUser,
                  avatar: lastMessage.payload.avatar || prev.otherUser.avatar,
                  displayName: lastMessage.payload.displayName || prev.otherUser.displayName
                }
              };
            });
          }
          
          // For any chat (group or direct), update the chat messages which include this user
          queryClient.invalidateQueries({ 
            queryKey: [`/api/chats/${selectedChat.id}/messages`] 
          });
        }
        
        // Also update the chats list to reflect the change
        queryClient.invalidateQueries({ queryKey: ['/api/chats'] });
        break;
        
      case 'user_status_changed':
        // Refresh chats to update user statuses
        queryClient.invalidateQueries({ queryKey: ['/api/chats'] });
        break;
        
      case 'group_invitation':
        // Refresh chats to show the new group invitation
        queryClient.invalidateQueries({ queryKey: ['/api/chats'] });
        
        toast({
          title: 'New Group Invitation',
          description: `You've been invited to join ${lastMessage.payload.chat.name || 'a group chat'}`,
          duration: 5000,
        });
        break;
        
      case 'user_joined_group':
        // Refresh participants if it's the current chat
        if (selectedChat && lastMessage.payload.chatId === selectedChat.id) {
          queryClient.invalidateQueries({ queryKey: ['/api/chats'] });
          
          toast({
            title: 'User Joined',
            description: `${lastMessage.payload.user?.displayName || 'Someone'} joined the group`,
            duration: 3000,
          });
        }
        break;

      case 'user_left_group':
        // Refresh participants if it's the current chat
        if (selectedChat && lastMessage.payload.chatId === selectedChat.id) {
          queryClient.invalidateQueries({ queryKey: ['/api/chats'] });
          
          toast({
            title: 'User Left',
            description: `${lastMessage.payload.displayName || 'Someone'} left the group`,
            duration: 3000,
          });
        }
        break;
        
      default:
        // For other message types, just log them
        console.log('Unhandled WebSocket message type:', lastMessage.type);
    }
  }, [lastMessage, selectedChat, toast]);

  // Connection status effect
  useEffect(() => {
    if (isConnected) {
      console.log('Connected to WebSocket server');
    } else {
      console.log('Disconnected from WebSocket server');
    }
  }, [isConnected]);

  // Create a new group chat
  const createGroupChat = async (name: string, participants: number[]) => {
    try {
      const response = await fetch('/api/chats/group', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, participants }),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to create group chat');
      }

      // Refresh chats list
      queryClient.invalidateQueries({ queryKey: ['/api/chats'] });
    } catch (error) {
      console.error('Error creating group chat:', error);
      throw error;
    }
  };

  // Accept a group chat invitation
  const acceptGroupInvitation = async (chatId: number) => {
    try {
      const response = await fetch(`/api/chats/${chatId}/invitation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accept: true }),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to accept invitation');
      }

      // Refresh chats list
      queryClient.invalidateQueries({ queryKey: ['/api/chats'] });
    } catch (error) {
      console.error('Error accepting group invitation:', error);
      throw error;
    }
  };

  // Reject a group chat invitation
  const rejectGroupInvitation = async (chatId: number) => {
    try {
      const response = await fetch(`/api/chats/${chatId}/invitation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accept: false }),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to reject invitation');
      }

      // Refresh chats list
      queryClient.invalidateQueries({ queryKey: ['/api/chats'] });
    } catch (error) {
      console.error('Error rejecting group invitation:', error);
      throw error;
    }
  };

  // Leave a group chat
  const leaveGroupChat = async (chatId: number) => {
    try {
      const response = await fetch(`/api/chats/${chatId}/leave`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to leave group chat');
      }

      // If we're currently viewing this chat, clear the selection
      if (selectedChat && selectedChat.id === chatId) {
        setSelectedChat(null);
      }
      
      // Refresh chats list
      queryClient.invalidateQueries({ queryKey: ['/api/chats'] });
      toast({
        title: 'Left Group',
        description: 'You have successfully left the group chat',
        duration: 3000,
      });
    } catch (error) {
      console.error('Error leaving group chat:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to leave group chat',
        variant: 'destructive',
      });
      throw error;
    }
  };

  // Refresh chats
  const refreshChats = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/chats'] });
  };
  
  // Refresh messages for a specific chat
  const refreshMessages = (chatId: number) => {
    queryClient.invalidateQueries({ queryKey: [`/api/chats/${chatId}/messages`] });
  };

  return (
    <ChatContext.Provider
      value={{
        selectedChat,
        setSelectedChat,
        createGroupChat,
        acceptGroupInvitation,
        rejectGroupInvitation,
        leaveGroupChat,
        refreshChats,
        refreshMessages,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

// Hook to use the chat context
export const useChatContext = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
};
