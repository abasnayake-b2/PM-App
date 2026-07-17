import { initials } from '@/utils/allocationUi';
import { useAuthenticatedImage } from '@/hooks/useAuthenticatedImage';

interface ResourceAvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  /** Relative API path such as /team-roster/members/{id}/photo */
  imageUrl?: string | null;
}

const sizes = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-20 w-20 text-xl',
};

export function ResourceAvatar({ name, size = 'md', imageUrl }: ResourceAvatarProps) {
  const photoSrc = useAuthenticatedImage(imageUrl);
  const sizeClass = sizes[size];

  if (photoSrc) {
    return (
      <img
        src={photoSrc}
        alt={name}
        className={`shrink-0 rounded-full object-cover ${sizeClass}`}
      />
    );
  }

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-accent/20 font-semibold text-accent ${sizeClass}`}
    >
      {initials(name)}
    </div>
  );
}
