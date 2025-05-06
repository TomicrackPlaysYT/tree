import { useState, useEffect, useRef } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AvatarStatus } from '@/components/ui/avatar-status';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Camera, Upload } from 'lucide-react';
import { z } from 'zod';

// Form schema
const profileSchema = z.object({
  displayName: z.string().min(2, {
    message: "Display name must be at least 2 characters.",
  }),
  status: z.string().max(100, {
    message: "Status cannot exceed 100 characters.",
  }),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

interface UserProfileProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserProfile({ open, onOpenChange }: UserProfileProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Initialize form
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: user?.displayName || '',
      status: user?.status || 'Hey, I\'m using RBLXC!',
    },
  });
  
  // Update form values when user data changes
  useEffect(() => {
    if (user) {
      form.reset({
        displayName: user.displayName,
        status: user.status || 'Hey, I\'m using RBLXC!',
      });
    }
  }, [user, form, open]);
  
  // Handle avatar image upload
  const handleAvatarUpload = () => {
    fileInputRef.current?.click();
  };
  
  // Process the selected image file
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Profile picture must be less than 5MB",
        variant: "destructive"
      });
      return;
    }
    
    // Check file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file",
        variant: "destructive"
      });
      return;
    }
    
    try {
      setAvatarLoading(true);
      
      // Convert the file to a data URL
      const reader = new FileReader();
      reader.onload = async (event) => {
        const imageData = event.target?.result as string;
        
        try {
          const response = await apiRequest('POST', '/api/user/avatar', { imageData });
          const updatedUser = await response.json();
          
          // Add a timestamp to force re-rendering
          const timestamp = Date.now();
          if (updatedUser && updatedUser.avatar && updatedUser.avatar.startsWith('data:image/')) {
            updatedUser.avatar = `${updatedUser.avatar}#${timestamp}`;
          }
          
          // Update the user in the cache
          queryClient.setQueryData(['/api/user'], updatedUser);
          
          // Also update any chat-related queries that might show the user's avatar
          queryClient.invalidateQueries(['/api/chats']);
          
          toast({
            title: "Profile picture updated",
            description: "Your profile picture has been updated successfully",
          });
        } catch (error) {
          toast({
            title: "Failed to update profile picture",
            description: error instanceof Error ? error.message : "An unknown error occurred",
            variant: "destructive"
          });
        } finally {
          setAvatarLoading(false);
        }
      };
      
      reader.readAsDataURL(file);
    } catch (error) {
      toast({
        title: "Error processing image",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive"
      });
      setAvatarLoading(false);
    }
  };
  
  // Handle form submission
  const onSubmit = async (values: ProfileFormValues) => {
    setIsLoading(true);
    
    try {
      await apiRequest('PATCH', '/api/user/profile', values);
      
      // Update cache
      queryClient.setQueryData(['/api/user'], (oldData: any) => ({
        ...oldData,
        displayName: values.displayName,
        status: values.status,
      }));
      
      toast({
        title: 'Profile updated',
        description: 'Your profile has been updated successfully.',
      });
      
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Failed to update profile',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center mb-4">
          <div className="relative group">
            <AvatarStatus
              src={user?.avatar}
              alt={user?.displayName || 'User'}
              size="lg"
              verified={user?.isVerified}
            />
            <div
              className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              onClick={handleAvatarUpload}
            >
              {avatarLoading ? (
                <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Camera className="h-5 w-5 text-white" />
              )}
            </div>
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            accept="image/*" 
            className="hidden" 
            onChange={handleFileChange}
          />
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 text-xs"
            onClick={handleAvatarUpload}
            disabled={avatarLoading}
          >
            {avatarLoading ? 'Uploading...' : 'Change Picture'}
          </Button>
          <p className="text-sm text-neutral-500 mt-1">@{user?.username}</p>
        </div>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Your display name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="What's on your mind?"
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="flex justify-end space-x-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
