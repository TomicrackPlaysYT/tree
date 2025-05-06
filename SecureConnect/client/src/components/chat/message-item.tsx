import { useState, useRef } from 'react';
import { format } from 'date-fns';
import { MoreHorizontal, Reply, Edit, Trash2, Copy, Download, Check } from 'lucide-react';
import { AvatarStatus } from '@/components/ui/avatar-status';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useWebSocket } from '@/hooks/use-websocket';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';

interface MessageProps {
  message: {
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
      displayName: string;
      username: string;
      avatar?: string;
      isVerified: boolean;
    };
    replyTo?: {
      id: number;
      content: string | null;
      sender?: {
        displayName: string;
      };
    };
  };
  isOwnMessage: boolean;
}

export function MessageItem({ message, isOwnMessage }: MessageProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { sendMessage } = useWebSocket();
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [emojiPickerVisible, setEmojiPickerVisible] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);
  
  // Format timestamp
  const timestamp = format(new Date(message.createdAt), 'h:mm a');
  
  // Check if message is deleted or content is empty
  const isInvalidMessage = message.isDeleted || !message.content;
  
  // Helper to create common class names for the message bubble
  const bubbleClasses = isOwnMessage
    ? 'bg-primary text-white'
    : 'bg-white text-neutral-800';
  
  // Handle reaction click
  const handleReaction = (emoji: string) => {
    sendMessage({
      type: 'message_reaction',
      messageId: message.id,
      reaction: emoji,
    });
    setEmojiPickerVisible(false);
  };
  
  // Handle edit message
  const handleEdit = () => {
    setIsEditing(true);
    setEditText(message.content || '');
    setTimeout(() => {
      editInputRef.current?.focus();
    }, 0);
  };
  
  // Save edited message
  const saveEdit = async () => {
    if (editText.trim() === message.content) {
      setIsEditing(false);
      return;
    }
    
    try {
      await apiRequest('PATCH', `/api/messages/${message.id}`, {
        content: editText.trim(),
      });
      
      // Update local message
      queryClient.setQueryData(['/api/chats', message.chatId, 'messages'], (old: any) => {
        if (!old) return [];
        return old.map((msg: any) =>
          msg.id === message.id ? { ...msg, content: editText.trim(), isEdited: true } : msg
        );
      });
      
      setIsEditing(false);
    } catch (error) {
      toast({
        title: 'Failed to edit message',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };
  
  // Handle delete message
  const handleDelete = async () => {
    try {
      await apiRequest('DELETE', `/api/messages/${message.id}`, {});
      
      // Update local message
      queryClient.setQueryData(['/api/chats', message.chatId, 'messages'], (old: any) => {
        if (!old) return [];
        return old.map((msg: any) =>
          msg.id === message.id ? { ...msg, isDeleted: true, content: null, mediaUrl: null } : msg
        );
      });
      
      toast({
        title: 'Message deleted',
      });
    } catch (error) {
      toast({
        title: 'Failed to delete message',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };
  
  // Handle reply to message
  const handleReply = () => {
    toast({
      title: 'Reply feature',
      description: 'Reply to message feature is not implemented in this version',
    });
  };
  
  // Handle copy message
  const handleCopy = () => {
    if (message.content) {
      navigator.clipboard.writeText(message.content);
      toast({
        title: 'Message copied to clipboard',
      });
    }
  };
  
  // Cancel editing
  const cancelEdit = () => {
    setIsEditing(false);
  };
  
  // Handle key down in edit input
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      saveEdit();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };
  
  // Get all reactions for display
  const reactionItems = Object.entries(message.reactions || {}).map(([emoji, userIds]) => ({
    emoji,
    count: userIds.length,
    reacted: userIds.includes(user?.id || 0),
  }));
  
  return (
    <div className={`flex mb-4 ${isOwnMessage ? 'justify-end' : ''}`}>
      {/* Sender avatar (only shown for received messages) */}
      {!isOwnMessage && message.sender && (
        <AvatarStatus
          src={message.sender.avatar}
          alt={message.sender.displayName}
          size="sm"
          verified={message.sender.isVerified}
          className="self-end mr-2"
        />
      )}
      
      <div className={`chat-message ${bubbleClasses} rounded-lg p-3 shadow-sm max-w-[65%] relative`}>
        {/* Reply preview if message is a reply */}
        {message.replyTo && message.replyTo.content && (
          <div className={`text-xs mb-2 pb-2 border-b ${isOwnMessage ? 'border-white border-opacity-20' : 'border-neutral-200'}`}>
            <p className={`font-semibold ${isOwnMessage ? 'text-white text-opacity-90' : 'text-neutral-600'}`}>
              {message.replyTo.sender?.displayName || 'User'}
            </p>
            <p className={`truncate ${isOwnMessage ? 'text-white text-opacity-80' : 'text-neutral-500'}`}>
              {message.replyTo.content}
            </p>
          </div>
        )}
        
        {/* Message content */}
        {isInvalidMessage ? (
          <p className={`italic ${isOwnMessage ? 'text-white text-opacity-75' : 'text-neutral-500'}`}>
            This message was deleted
          </p>
        ) : isEditing ? (
          <input
            ref={editInputRef}
            type="text"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full p-1 rounded bg-white text-neutral-800 focus:outline-none focus:ring-2 focus:ring-primary"
            autoFocus
          />
        ) : (
          <>
            {/* Media content based on type */}
            {message.type === 'image' && message.mediaUrl && (
              <div className="mb-2">
                <img
                  src={message.mediaUrl}
                  alt="Shared image"
                  className="rounded-lg max-w-full h-auto"
                />
              </div>
            )}
            
            {message.type === 'document' && message.mediaUrl && (
              <div className={`flex items-center ${isOwnMessage ? 'bg-white bg-opacity-10' : 'bg-neutral-100'} rounded-lg p-2 mb-2`}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`mr-2 ${isOwnMessage ? 'text-white' : 'text-neutral-700'}`} width="20" height="20">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${isOwnMessage ? 'text-white' : 'text-neutral-800'}`}>
                    {message.mediaUrl.split('/').pop() || 'File'}
                  </p>
                </div>
                <button className={`p-1 ${isOwnMessage ? 'text-white' : 'text-primary'}`}>
                  <Download className="h-4 w-4" />
                </button>
              </div>
            )}
            
            {/* Message text */}
            {message.content && (
              <p className="break-words">{message.content}</p>
            )}
          </>
        )}
        
        {/* Reactions */}
        {reactionItems.length > 0 && (
          <div className={`${isOwnMessage ? 'bg-white bg-opacity-20' : 'bg-neutral-100'} -mx-1 mt-1 px-2 py-0.5 rounded-lg flex items-center flex-wrap`}>
            {reactionItems.map((reaction) => (
              <div
                key={reaction.emoji}
                className={`flex items-center mr-1 ${reaction.reacted ? 'opacity-100' : 'opacity-70'}`}
                onClick={() => handleReaction(reaction.emoji)}
              >
                <span className="text-sm">{reaction.emoji}</span>
                <span className={`text-xs ml-1 ${isOwnMessage ? 'text-white' : 'text-neutral-600'}`}>{reaction.count}</span>
              </div>
            ))}
          </div>
        )}
        
        {/* Message timestamp and status */}
        <div className="absolute right-2 bottom-1 flex items-center">
          <span className={`text-xs ${isOwnMessage ? 'text-white text-opacity-70' : 'text-neutral-500'}`}>
            {timestamp}
            {message.isEdited && <span className="ml-1">(edited)</span>}
          </span>
          
          {isOwnMessage && !isInvalidMessage && !isEditing && (
            <span className="material-icons text-white text-opacity-70 ml-1 text-xs">
              <Check className="h-3 w-3" />
            </span>
          )}
        </div>
      </div>
      
      {/* Message actions */}
      {!isInvalidMessage && !isEditing && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={`opacity-0 hover:opacity-100 focus:opacity-100 p-1 rounded-full ${isOwnMessage ? 'ml-1' : 'mr-1'}`}>
              <MoreHorizontal className="h-4 w-4 text-neutral-500" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={isOwnMessage ? 'end' : 'start'}>
            <DropdownMenuItem onClick={handleReply}>
              <Reply className="h-4 w-4 mr-2" />
              Reply
            </DropdownMenuItem>
            
            {isOwnMessage && (
              <DropdownMenuItem onClick={handleEdit}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
            )}
            
            <DropdownMenuItem onClick={handleCopy}>
              <Copy className="h-4 w-4 mr-2" />
              Copy
            </DropdownMenuItem>
            
            {message.mediaUrl && (
              <DropdownMenuItem>
                <Download className="h-4 w-4 mr-2" />
                Download
              </DropdownMenuItem>
            )}
            
            {isOwnMessage && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleDelete}
                  className="text-accent-red focus:text-accent-red"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
