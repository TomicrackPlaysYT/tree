import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AvatarStatus } from "@/components/ui/avatar-status";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useWebSocket } from "@/hooks/use-websocket";

interface ChatRequestProps {
  id: number;
  sender: {
    id: number;
    displayName: string;
    username: string;
    avatar?: string;
    isVerified: boolean;
  };
  onAccept: (id: number) => void;
  onReject: (id: number) => void;
}

function ChatRequest({ id, sender, onAccept, onReject }: ChatRequestProps) {
  return (
    <div className="flex items-center justify-between p-2 rounded-lg hover:bg-neutral-100 mb-1 cursor-pointer">
      <div className="flex items-center">
        <AvatarStatus 
          src={sender.avatar} 
          alt={sender.displayName}
          verified={sender.isVerified}
        />
        <div className="ml-3">
          <p className="font-medium text-sm">{sender.displayName}</p>
          <p className="text-xs text-neutral-500">Wants to chat with you</p>
        </div>
      </div>
      <div className="flex space-x-1">
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 rounded-full text-accent"
          onClick={() => onAccept(id)}
        >
          <Check className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 rounded-full text-accent-red"
          onClick={() => onReject(id)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function ChatRequestList() {
  const { toast } = useToast();
  const { lastMessage } = useWebSocket();
  
  // Fetch chat requests
  const { data: requests, isLoading } = useQuery({
    queryKey: ["/api/friend-requests"],
    queryFn: async () => {
      const res = await fetch("/api/friend-requests", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch friend requests");
      return res.json();
    }
  });
  
  // Listen for new friend requests
  useEffect(() => {
    if (lastMessage && lastMessage.type === 'friend_request') {
      queryClient.invalidateQueries({ queryKey: ['/api/friend-requests'] });
      
      toast({
        title: "New chat request",
        description: `${lastMessage.payload.sender.displayName} wants to chat with you.`
      });
    }
  }, [lastMessage, toast]);
  
  // Handle accepting a request
  const handleAccept = async (requestId: number) => {
    try {
      await apiRequest("POST", `/api/friend-request/${requestId}/respond`, { accept: true });
      
      toast({
        title: "Request accepted",
        description: "You can now chat with this user."
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/friend-requests'] });
      queryClient.invalidateQueries({ queryKey: ['/api/chats'] });
    } catch (error) {
      toast({
        title: "Failed to accept request",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      });
    }
  };
  
  // Handle rejecting a request
  const handleReject = async (requestId: number) => {
    try {
      await apiRequest("POST", `/api/friend-request/${requestId}/respond`, { accept: false });
      
      toast({
        title: "Request rejected",
        description: "The user won't be able to contact you."
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/friend-requests'] });
    } catch (error) {
      toast({
        title: "Failed to reject request",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive"
      });
    }
  };
  
  // If no requests or still loading, don't show anything
  if (isLoading || !requests || requests.length === 0) {
    return null;
  }
  
  return (
    <div className="bg-neutral-50 p-3 border-y border-neutral-200 mb-2">
      <h3 className="text-xs font-medium text-neutral-500 mb-2">
        PENDING REQUESTS ({requests.length})
      </h3>
      
      <ScrollArea className={requests.length > 3 ? "h-40" : ""}>
        {requests.map((request) => (
          <ChatRequest
            key={request.id}
            id={request.id}
            sender={request.sender}
            onAccept={handleAccept}
            onReject={handleReject}
          />
        ))}
      </ScrollArea>
    </div>
  );
}
