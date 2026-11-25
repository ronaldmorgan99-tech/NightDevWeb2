import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router';
import {
  MoreVertical,
  Edit2,
  Eye,
  EyeOff,
  Trash2,
  Flag,
  Link as LinkIcon,
  Quote,
  LogIn,
  Check
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  buildPostPermalink,
  computeMenuPosition,
  getPostMenuItems,
  type MenuPosition,
  type PostMenuContext,
  type PostMenuItemId
} from '../lib/postMenu';

export type PostOverflowMenuProps = {
  postId: number;
  threadLocked: boolean;
  isHidden: boolean;
  isHiddenPlaceholder?: boolean;
  postAuthorId: number;
  viewer: PostMenuContext['viewer'];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onHide: () => void;
  onDelete: () => void;
  onReport: () => void;
  onQuote: () => void;
};

const MENU_WIDTH = 208;

const ITEM_LABELS: Record<PostMenuItemId, string> = {
  quote: 'Quote / Reply',
  'copy-link': 'Copy link',
  edit: 'Edit',
  hide: 'Hide',
  unhide: 'Unhide',
  report: 'Report',
  'sign-in': 'Sign in to report',
  delete: 'Delete'
};

const ITEM_ICONS: Record<PostMenuItemId, React.ReactNode> = {
  quote: <Quote className="w-3.5 h-3.5" />,
  'copy-link': <LinkIcon className="w-3.5 h-3.5" />,
  edit: <Edit2 className="w-3.5 h-3.5" />,
  hide: <EyeOff className="w-3.5 h-3.5" />,
  unhide: <Eye className="w-3.5 h-3.5" />,
  report: <Flag className="w-3.5 h-3.5" />,
  'sign-in': <LogIn className="w-3.5 h-3.5" />,
  delete: <Trash2 className="w-3.5 h-3.5" />
};

function itemClassName(id: PostMenuItemId, active: boolean): string {
  const base =
    'w-full flex items-center gap-2 px-3 py-2 text-[10px] uppercase tracking-widest font-black text-left transition-colors';
  const tone =
    id === 'delete'
      ? 'text-zinc-400 hover:text-neon-pink hover:bg-neon-pink/10'
      : id === 'report'
        ? 'text-zinc-400 hover:text-red-400 hover:bg-red-500/10'
        : id === 'hide' || id === 'unhide'
          ? 'text-zinc-400 hover:text-orange-400 hover:bg-orange-500/10'
          : id === 'quote' || id === 'sign-in'
            ? 'text-zinc-400 hover:text-neon-cyan hover:bg-neon-cyan/10'
            : 'text-zinc-400 hover:text-white hover:bg-white/5';
  return `${base} ${tone} ${active ? 'bg-white/5 text-white' : ''}`;
}

async function copyToClipboard(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const el = document.createElement('textarea');
  el.value = text;
  el.setAttribute('readonly', '');
  el.style.position = 'fixed';
  el.style.left = '-9999px';
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
}

const PostOverflowMenu: React.FC<PostOverflowMenuProps> = ({
  postId,
  threadLocked,
  isHidden,
  isHiddenPlaceholder,
  postAuthorId,
  viewer,
  isOpen,
  onOpenChange,
  onEdit,
  onHide,
  onDelete,
  onReport,
  onQuote
}) => {
  const items = getPostMenuItems({
    viewer,
    postAuthorId,
    isHidden,
    isLocked: threadLocked,
    isHiddenPlaceholder
  });
  const reactId = useId();
  const menuId = `post-menu-${postId}-${reactId}`;
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | HTMLAnchorElement | null>>([]);
  const menuRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [position, setPosition] = useState<MenuPosition | null>(null);

  // Close on any route change, including hash and ?post= changes from Copy link or back/forward.
  const location = useLocation();
  const locationKey = `${location.pathname}${location.search}${location.hash}`;
  const lastLocationKey = useRef(locationKey);
  useEffect(() => {
    if (lastLocationKey.current === locationKey) return;
    lastLocationKey.current = locationKey;
    if (isOpen) onOpenChange(false);
  }, [locationKey, isOpen, onOpenChange]);

  // The menu renders in a portal with fixed positioning, so post cards with overflow-hidden
  // cannot clip it. It opens above the button (over the post header, not the post text),
  // right-aligned, falls back to below when there is no room above, and stays in the viewport.
  const updatePosition = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const menuHeight = menuRef.current?.offsetHeight ?? items.length * 36 + 8;
    // Keep the menu clear of the sticky site header.
    const header = document.querySelector('header');
    const headerBottom = header ? Math.max(0, header.getBoundingClientRect().bottom) : 0;
    setPosition(
      computeMenuPosition(rect, { width: window.innerWidth, height: window.innerHeight }, menuHeight, MENU_WIDTH, 8, 8, headerBottom + 8)
    );
  }, [items.length]);

  useLayoutEffect(() => {
    if (!isOpen) {
      setPosition(null);
      return;
    }
    updatePosition();
    const frame = window.requestAnimationFrame(updatePosition);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (!isOpen) {
      setCopied(false);
      return;
    }
    setActiveIndex(0);
    const focusFirst = window.setTimeout(() => {
      itemRefs.current[0]?.focus();
    }, 0);

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const insideRoot = rootRef.current?.contains(target);
      const insideMenu = menuRef.current?.contains(target);
      if (!insideRoot && !insideMenu) {
        onOpenChange(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onOpenChange(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(focusFirst);
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onOpenChange]);

  const moveFocus = (next: number) => {
    const count = items.length;
    if (count === 0) return;
    const index = (next + count) % count;
    setActiveIndex(index);
    itemRefs.current[index]?.focus();
  };

  const onMenuKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveFocus(activeIndex + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveFocus(activeIndex - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      moveFocus(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      moveFocus(items.length - 1);
    } else if (event.key === 'Tab') {
      onOpenChange(false);
    }
  };

  const runAction = async (id: PostMenuItemId) => {
    switch (id) {
      case 'quote':
        onQuote();
        onOpenChange(false);
        break;
      case 'copy-link': {
        const url = buildPostPermalink(window.location.href, postId);
        try {
          await copyToClipboard(url);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        } catch {
          setCopied(false);
        }
        break;
      }
      case 'edit':
        onEdit();
        onOpenChange(false);
        break;
      case 'hide':
      case 'unhide':
        onHide();
        onOpenChange(false);
        break;
      case 'report':
        onReport();
        onOpenChange(false);
        break;
      case 'delete':
        onDelete();
        onOpenChange(false);
        break;
      case 'sign-in':
        onOpenChange(false);
        break;
    }
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="hover:text-white transition-colors p-1 rounded-lg"
        aria-label="More options"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={() => onOpenChange(!isOpen)}
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {typeof document !== 'undefined' && createPortal(
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label="Post actions"
            data-placement={position?.placement ?? 'below'}
            initial={{ opacity: 0, y: position?.placement === 'above' ? -6 : 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: position?.placement === 'above' ? -6 : 6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            onKeyDown={onMenuKeyDown}
            style={{
              position: 'fixed',
              top: position?.top ?? -9999,
              left: position?.left ?? -9999,
              width: position?.width ?? MENU_WIDTH,
              visibility: position ? 'visible' : 'hidden'
            }}
            className="z-[130] max-w-[calc(100vw-16px)] bg-cyber-black border border-neon-cyan/25 rounded-xl overflow-hidden py-1 shadow-[0_18px_40px_-8px_rgba(0,0,0,0.9),0_0_0_1px_rgba(0,243,255,0.08),0_0_24px_-6px_rgba(0,243,255,0.35)]"
          >
            {items.map((id, index) => {
              const label =
                id === 'copy-link' && copied ? 'Copied' : ITEM_LABELS[id];
              const icon =
                id === 'copy-link' && copied
                  ? <Check className="w-3.5 h-3.5 text-neon-green" />
                  : ITEM_ICONS[id];
              const common = {
                key: id,
                role: 'menuitem' as const,
                className: itemClassName(id, index === activeIndex),
                onMouseEnter: () => setActiveIndex(index),
                onFocus: () => setActiveIndex(index)
              };

              if (id === 'sign-in') {
                return (
                  <Link
                    {...common}
                    ref={(el) => {
                      itemRefs.current[index] = el;
                    }}
                    to="/login"
                  >
                    {icon}
                    {label}
                  </Link>
                );
              }

              return (
                <button
                  {...common}
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                  type="button"
                  onClick={() => {
                    void runAction(id);
                  }}
                >
                  {icon}
                  {label}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
      )}
    </div>
  );
};

export default PostOverflowMenu;
