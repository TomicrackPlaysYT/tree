import { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Smile, Mic, X, FileImage, FileText, Videotape, ImagePlay } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useWebSocket } from '@/hooks/use-websocket';
import { useTheme } from '@/hooks/use-theme';
import { queryClient } from '@/lib/queryClient';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';

interface MessageInputProps {
  chatId: number;
  onTyping?: () => void;
}

export function MessageInput({ chatId, onTyping }: MessageInputProps) {
  const { toast } = useToast();
  const { sendMessage } = useWebSocket();
  const { primaryColor } = useTheme();
  
  const [message, setMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentButtonRef = useRef<HTMLButtonElement>(null);
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const attachmentMenuRef = useRef<HTMLDivElement>(null);
  
  // Recording timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime(time => time + 1);
      }, 1000);
    } else {
      setRecordingTime(0);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);
  
  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Close emoji picker when clicking outside
      if (
        showEmojiPicker &&
        emojiPickerRef.current && 
        !emojiPickerRef.current.contains(event.target as Node) &&
        emojiButtonRef.current && 
        !emojiButtonRef.current.contains(event.target as Node)
      ) {
        setShowEmojiPicker(false);
      }
      
      // Close attachment menu when clicking outside
      if (
        showAttachmentMenu &&
        attachmentMenuRef.current && 
        !attachmentMenuRef.current.contains(event.target as Node) &&
        attachmentButtonRef.current && 
        !attachmentButtonRef.current.contains(event.target as Node)
      ) {
        setShowAttachmentMenu(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEmojiPicker, showAttachmentMenu]);
  
  // Handle typing indicator
  const handleTyping = () => {
    if (onTyping) {
      onTyping();
    }
    
    // Clear existing timeout
    if (typingTimeout) {
      clearTimeout(typingTimeout);
    }
    
    // Set new timeout
    const timeout = setTimeout(() => {
      setTypingTimeout(null);
    }, 3000);
    
    setTypingTimeout(timeout);
  };
  
  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value);
    handleTyping();
  };
  
  // Handle send message
  const handleSendMessage = async () => {
    if (!message.trim() && !isRecording) return;
    
    if (isRecording) {
      // Handle sending voice message
      setIsRecording(false);
      toast({
        title: "Voice message",
        description: "Voice message feature is not implemented yet",
      });
      return;
    }
    
    try {
      // Send text message via HTTP request
      const response = await fetch(`/api/chats/${chatId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: message.trim(),
          type: 'text'
        }),
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to send message');
      }
      
      // Get the result
      const result = await response.json();
      console.log('Message sent successfully with complete data:', result);
      
      // Clear input immediately
      setMessage('');
      
      // Update the local cache with the new message
      queryClient.setQueryData([`/api/chats/${chatId}/messages`], (oldData: any) => {
        if (!oldData) return [result];
        
        // Check if the message is already in the list (prevent duplicates)
        const messageExists = oldData.some((msg: any) => msg.id === result.id);
        if (messageExists) {
          console.log('Message already exists in cache, not adding again');
          return oldData;
        }
        
        console.log('Adding new message to cache from HTTP response');
        return [...oldData, result];
      });
      
      // Also update the chat list to show the latest message
      queryClient.invalidateQueries({ queryKey: ['/api/chats'] });
      
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive"
      });
    }
  };
  
  // Handle adding emoji
  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setMessage(prev => prev + emojiData.emoji);
  };
  
  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Maximum file size is 10MB",
        variant: "destructive",
      });
      return;
    }
    
    // TODO: Upload file and send message
    toast({
      title: "File selected",
      description: `Selected file: ${file.name}`,
    });
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    
    // Close attachment menu
    setShowAttachmentMenu(false);
  };
  
  // Start voice recording
  const startRecording = () => {
    // For now, just simulate recording
    setIsRecording(true);
    toast({
      title: "Recording started",
      description: "Voice recording feature is simulated",
    });
  };
  
  // Stop voice recording
  const stopRecording = () => {
    setIsRecording(false);
    toast({
      title: "Recording stopped",
      description: `Recorded for ${recordingTime} seconds`,
    });
  };
  
  // Format recording time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <div className="bg-white border-t border-neutral-200 p-3 relative">
      {/* Attachment menu */}
      {showAttachmentMenu && (
        <div 
          ref={attachmentMenuRef}
          className="absolute bottom-16 left-4 bg-white rounded-lg shadow-lg p-2 z-10"
        >
          <div className="grid grid-cols-4 gap-2">
            <button 
              className="flex flex-col items-center p-2 hover:bg-neutral-100 rounded-lg"
              onClick={() => {
                fileInputRef.current?.click();
                setShowAttachmentMenu(false);
              }}
            >
              <FileImage className="h-5 w-5 text-primary" />
              <span className="text-xs mt-1">Photo</span>
            </button>
            <button 
              className="flex flex-col items-center p-2 hover:bg-neutral-100 rounded-lg"
              onClick={() => {
                fileInputRef.current?.click();
                setShowAttachmentMenu(false);
              }}
            >
              <Videotape className="h-5 w-5 text-primary" />
              <span className="text-xs mt-1">Video</span>
            </button>
            <button 
              className="flex flex-col items-center p-2 hover:bg-neutral-100 rounded-lg"
              onClick={() => {
                fileInputRef.current?.click();
                setShowAttachmentMenu(false);
              }}
            >
              <FileText className="h-5 w-5 text-primary" />
              <span className="text-xs mt-1">Document</span>
            </button>
            <button 
              className="flex flex-col items-center p-2 hover:bg-neutral-100 rounded-lg"
              onClick={() => {
                toast({
                  title: "Contact sharing",
                  description: "Contact sharing feature is not implemented yet",
                });
                setShowAttachmentMenu(false);
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-primary">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              <span className="text-xs mt-1">Contact</span>
            </button>
          </div>
        </div>
      )}
      
      {/* Emoji picker */}
      {showEmojiPicker && (
        <div 
          ref={emojiPickerRef}
          className="absolute bottom-16 right-4 z-10"
        >
          <EmojiPicker onEmojiClick={handleEmojiClick} width={320} height={350} />
        </div>
      )}
      
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileSelect}
        accept="image/*,video/*,audio/*,application/*"
      />
      
      {/* Message input */}
      <div className="flex items-center">
        <div className="flex space-x-2">
          <Button
            ref={attachmentButtonRef}
            size="icon"
            variant="ghost"
            className="h-10 w-10 rounded-full text-neutral-600"
            onClick={() => {
              setShowAttachmentMenu(!showAttachmentMenu);
              setShowEmojiPicker(false);
            }}
            title="Add attachment"
          >
            <Paperclip className="h-5 w-5" />
          </Button>
          <Button
            ref={emojiButtonRef}
            size="icon"
            variant="ghost"
            className="h-10 w-10 rounded-full text-neutral-600"
            onClick={() => {
              setShowEmojiPicker(!showEmojiPicker);
              setShowAttachmentMenu(false);
            }}
            title="Send emoji"
          >
            <Smile className="h-5 w-5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-10 w-10 rounded-full text-neutral-600"
            onClick={() => {
              toast({
                title: "GIF sharing",
                description: "GIF sharing feature is not implemented yet",
              });
            }}
            title="Send GIF"
          >
            <ImagePlay className="h-5 w-5" />
          </Button>
        </div>
        
        <div className="flex-1 mx-2">
          {isRecording ? (
            <div className="flex items-center justify-between bg-neutral-100 rounded-full py-2 px-4">
              <div className="flex items-center">
                <span className="h-2 w-2 bg-accent-red rounded-full mr-2 animate-pulse" />
                <span className="text-sm">Recording... {formatTime(recordingTime)}</span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={stopRecording}
                className="h-6 w-6 rounded-full p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Input
              type="text"
              placeholder="Type a message..."
              className="py-2 px-4 rounded-full bg-neutral-100"
              value={message}
              onChange={handleInputChange}
              onKeyDown={handleKeyPress}
            />
          )}
        </div>
        
        <div>
          {message.trim() || isRecording ? (
            <Button
              size="icon"
              className="h-10 w-10 rounded-full"
              style={{ backgroundColor: primaryColor }}
              onClick={handleSendMessage}
              title="Send message"
            >
              <Send className="h-5 w-5" />
            </Button>
          ) : (
            <Button
              size="icon"
              variant="ghost"
              className="h-10 w-10 rounded-full text-neutral-600 mr-1"
              onClick={startRecording}
              title="Voice message"
            >
              <Mic className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
