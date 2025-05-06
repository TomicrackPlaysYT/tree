import { useState } from 'react';
import { Info, MoreVertical, UserMinus, Users, Trash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useChatContext } from '@/context/chat-context';

interface GroupChatMenuProps {
  chatId: number;
  onLeaveGroup: () => void;
}

export function GroupChatMenu({ chatId, onLeaveGroup }: GroupChatMenuProps) {
  const { leaveGroupChat } = useChatContext();
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false);
  
  const handleLeaveGroup = async () => {
    try {
      await leaveGroupChat(chatId);
      
      // Call the callback to navigate away and refresh the chat list
      onLeaveGroup();
    } catch (error) {
      console.error('Error leaving group:', error);
    } finally {
      setIsLeaveDialogOpen(false);
    }
  };
  
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            size="icon" 
            variant="ghost" 
            className="h-9 w-9 rounded-full text-neutral-600"
          >
            <MoreVertical className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem className="cursor-pointer">
            <Info className="mr-2 h-4 w-4" />
            <span>Group Info</span>
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer">
            <Users className="mr-2 h-4 w-4" />
            <span>View Members</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            className="cursor-pointer text-accent-red"
            onClick={() => setIsLeaveDialogOpen(true)}
          >
            <UserMinus className="mr-2 h-4 w-4" />
            <span>Leave Group</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      
      <AlertDialog open={isLeaveDialogOpen} onOpenChange={setIsLeaveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Group Chat</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to leave this group chat? You will not receive new messages from this group.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault();
                handleLeaveGroup();
              }}
              className="bg-accent-red hover:bg-red-700"
            >
              Leave Group
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}