import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type UserStatus = "online" | "offline" | "away" | "busy";

interface AvatarStatusProps {
  src?: string;
  alt: string;
  status?: UserStatus;
  size?: "sm" | "md" | "lg";
  verified?: boolean;
  className?: string;
}

export function AvatarStatus({
  src,
  alt,
  status,
  size = "md",
  verified = false,
  className,
}: AvatarStatusProps) {
  const initials = alt
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .substring(0, 2);

  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12",
  };
  
  const statusColors = {
    online: "bg-accent",
    away: "bg-accent-yellow",
    busy: "bg-accent-red",
    offline: "bg-neutral-400",
  };

  // Convert data URL to a valid image URL or use original src
  const processSrc = () => {
    // If no src provided, return undefined
    if (!src) return undefined;
    
    // Check if it's already a data URL (starts with 'data:image/')
    if (src.startsWith('data:image/')) {
      // Use the data URL directly, but add a cache-busting parameter
      return `${src}#${Date.now()}`;
    }
    
    // Otherwise, use the provided URL as is
    return src;
  };

  return (
    <div className={cn("relative", className)}>
      <Avatar className={sizeClasses[size]}>
        {src ? (
          <AvatarImage 
            src={processSrc()} 
            alt={alt} 
            className="object-cover"
            loading="eager" 
          />
        ) : null}
        <AvatarFallback className="bg-primary text-white">
          {initials}
        </AvatarFallback>
      </Avatar>
      
      {status && (
        <span 
          className={cn(
            "absolute bottom-0 right-0 rounded-full border-2 border-white",
            statusColors[status],
            size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"
          )}
        />
      )}
      
      {verified && (
        <span className="absolute -top-1 -right-1 text-blue-500 bg-white rounded-full drop-shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0 1 12 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 0 1 3.498 1.307 4.491 4.491 0 0 1 1.307 3.497A4.49 4.49 0 0 1 21.75 12a4.49 4.49 0 0 1-1.549 3.397 4.491 4.491 0 0 1-1.307 3.497 4.491 4.491 0 0 1-3.497 1.307A4.49 4.49 0 0 1 12 21.75a4.49 4.49 0 0 1-3.397-1.549 4.49 4.49 0 0 1-3.498-1.306 4.491 4.491 0 0 1-1.307-3.498A4.49 4.49 0 0 1 2.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 0 1 1.307-3.497 4.49 4.49 0 0 1 3.497-1.307Zm7.007 6.387a.75.75 0 1 0-1.22-.872l-3.236 4.53-1.471-1.47a.75.75 0 0 0-1.06 1.06l2 2a.75.75 0 0 0 1.14-.094l3.847-5.154Z" clipRule="evenodd" />
          </svg>
        </span>
      )}
    </div>
  );
}
