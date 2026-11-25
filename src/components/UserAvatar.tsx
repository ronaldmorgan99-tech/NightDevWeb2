import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router';

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const sizeClasses: Record<Size, string> = {
  xs: 'w-6 h-6 text-[10px] rounded-md',
  sm: 'w-8 h-8 text-xs rounded-lg',
  md: 'w-10 h-10 text-sm rounded-xl',
  lg: 'w-14 h-14 text-lg rounded-xl',
  xl: 'w-24 h-24 text-3xl rounded-2xl'
};

export const profilePath = (userId: number | string) => `/profile/${userId}`;

interface UserAvatarProps {
  name?: string | null;
  src?: string | null;
  size?: Size;
  className?: string;
}

/** Avatar image with a first-letter fallback (also used when the image fails to load). */
export const UserAvatar: React.FC<UserAvatarProps> = ({ name, src, size = 'md', className = '' }) => {
  const [failed, setFailed] = useState(false);
  const label = (name || '?').trim();
  const initial = label.charAt(0).toUpperCase() || '?';
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden bg-cyber-black border border-white/10 font-black text-white ${sizeClasses[size]} ${className}`}
    >
      {src && !failed ? (
        <img
          src={src}
          alt={label}
          className="w-full h-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <span aria-hidden="true">{initial}</span>
      )}
    </span>
  );
};

interface AuthorLinkProps {
  userId?: number | string | null;
  name?: string | null;
  avatar?: string | null;
  size?: Size;
  showName?: boolean;
  className?: string;
  nameClassName?: string;
  /**
   * Use inside another link (for example a whole forum card that is a <Link>):
   * renders a span that navigates on click instead of a nested <a>.
   */
  nested?: boolean;
}

/** Avatar + name that both open the user's profile. */
export const AuthorLink: React.FC<AuthorLinkProps> = ({
  userId,
  name,
  avatar,
  size = 'sm',
  showName = true,
  className = '',
  nameClassName = 'text-zinc-300 hover:text-neon-cyan',
  nested = false
}) => {
  const navigate = useNavigate();
  const displayName = name || 'Unknown';
  const content = (
    <>
      <UserAvatar name={displayName} src={avatar} size={size} />
      {showName && <span className={`truncate font-bold transition-colors ${nameClassName}`}>{displayName}</span>}
    </>
  );
  const baseClass = `inline-flex items-center gap-2 min-w-0 ${className}`;

  if (!userId) {
    return <span className={baseClass}>{content}</span>;
  }

  if (nested) {
    const go = (event: React.SyntheticEvent) => {
      event.preventDefault();
      event.stopPropagation();
      navigate(profilePath(userId));
    };
    return (
      <span
        role="link"
        tabIndex={0}
        title={`View ${displayName}'s profile`}
        className={`${baseClass} cursor-pointer`}
        onClick={go}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') go(event);
        }}
      >
        {content}
      </span>
    );
  }

  return (
    <Link to={profilePath(userId)} title={`View ${displayName}'s profile`} className={baseClass}>
      {content}
    </Link>
  );
};

export default UserAvatar;
