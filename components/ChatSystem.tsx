import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Message, ChatGroup, User, UserRole } from '../types';
import { Send, Image, Smile, Paperclip, Link2, PlusCircle, Users, Hash, X, Check, UserPlus, Trash2, Search, Phone, Video, FileText, FileImage, Film, Music, Archive, File as FileIcon, AlertCircle, ExternalLink, Forward, CheckCircle2, Loader2, Download } from 'lucide-react';
import { 
  createGroup as apiCreateGroup, 
  showCreatedGroups as apiShowCreatedGroups,
  showGroupMembers as apiShowGroupMembers,
  loadChats as apiLoadChats,
  startChat as apiStartChat,
  addUserToGroup as apiAddUserToGroup,
  deleteUserFromGroup as apiDeleteUserFromGroup,
  deleteGroup as apiDeleteGroup,
  postMessages as apiPostMessages,
  getMessages as apiGetMessages,
  initiateCall as apiInitiateCall,
  getCallableUsers as apiGetCallableUsers,
  initiateGroupCall as apiInitiateGroupCall,
  uploadFile as apiUploadFile,
  addLink as apiAddLink,
  deleteAttachment as apiDeleteAttachment,
  UploadedFileAttachment,
  LinkAttachment,
} from '../services/api';
import { useCallContext } from '../contexts/CallContext';
import { useChatWebSocket } from '../hooks/useChatWebSocket';
import { requestCallMediaPermissions } from '../utils/callMedia';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { MessageContent } from './chat/MessageContent';

interface ChatSystemProps {
  currentUser: User;
  groups: ChatGroup[];
  messages: Message[];
  users: User[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setGroups: React.Dispatch<React.SetStateAction<ChatGroup[]>>;
}

// ─── ForwardModal ─────────────────────────────────────────────────────────────
interface ForwardModalProps {
  message:      string;
  groups:       Array<{ group_id: number | string; name: string }>;
  users:        User[];
  currentUser:  User;
  directChats:  Record<string, string>;
  onClose:      () => void;
  onSendToChat: (chatId: string) => Promise<void>;
}

const ForwardModal: React.FC<ForwardModalProps> = ({
  message, groups, users, currentUser, directChats, onClose, onSendToChat,
}) => {
  const [search, setSearch]               = useState('');
  const [selected, setSelected]           = useState<Set<string>>(new Set()); // chatIds
  const [sending, setSending]             = useState(false);
  const [sentIds, setSentIds]             = useState<Set<string>>(new Set());
  const [error, setError]                 = useState<string | null>(null);

  // Derive a display label for the message
  const fileMatch = message.match(/^\[FILE:([^|]+)\|([^|]+)\|(.+)\]$/);
  const linkMatch = !fileMatch && message.match(/^\[LINK:([^|]*)\|(.+)\]$/);
  const previewLabel =
    fileMatch ? `📎 ${fileMatch[2]}` :
    linkMatch ? `🔗 ${linkMatch[1] || linkMatch[2]}` :
    message.length > 60 ? message.slice(0, 60) + '…' : message;

  const lc = search.toLowerCase().trim();

  // Build a flat list: groups + direct-message peers
  type Dest = { id: string; label: string; sub: string; kind: 'group' | 'dm' };
  const destinations: Dest[] = [
    ...groups.map((g) => ({
      id:    `G:${g.group_id}`,
      label: g.name,
      sub:   'Group',
      kind:  'group' as const,
    })),
    ...users
      .filter((u) => u.id !== currentUser.id && u.name !== currentUser.name)
      .map((u) => {
        // look up the chatId for this user
        const chatId =
          directChats[u.name] ||
          directChats[String(u.id)] ||
          (u as any).Employee_id ? directChats[String((u as any).Employee_id)] : undefined;
        return {
          id:    `D:${u.id}:${chatId ?? ''}`,
          label: u.name,
          sub:   (u as any).designation || (u as any).role || 'Direct message',
          kind:  'dm' as const,
          chatId,
        };
      }),
  ].filter((d) =>
    !lc ||
    d.label.toLowerCase().includes(lc) ||
    d.sub.toLowerCase().includes(lc),
  ) as (Dest & { chatId?: string })[];

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSend = async () => {
    if (selected.size === 0) return;
    setSending(true);
    setError(null);
    const errors: string[] = [];

    for (const destId of selected) {
      if (sentIds.has(destId)) continue;
      try {
        let chatId: string | undefined;
        if (destId.startsWith('G:')) {
          chatId = destId.slice(2); // group_id
        } else {
          // D:userId:chatId
          const parts = destId.split(':');
          chatId = parts[2] || undefined;
        }
        if (!chatId) { errors.push(`No chat ID for ${destId}`); continue; }
        await onSendToChat(chatId);
        setSentIds((prev) => new Set(prev).add(destId));
      } catch (e: any) {
        errors.push(e?.message || 'Failed');
      }
    }

    setSending(false);
    if (errors.length === 0) {
      // short delay so user sees the green ticks, then auto-close
      setTimeout(onClose, 800);
    } else {
      setError(errors.join('; '));
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200000] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-800 text-base">Forward message</h2>
            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[280px]">{previewLabel}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pt-3 pb-2">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search groups or people…"
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-400"
              autoFocus
            />
          </div>
        </div>

        {/* Destination list */}
        <div className="flex-1 overflow-y-auto px-2 py-1">
          {destinations.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">No chats found</p>
          ) : (
            destinations.map((dest) => {
              const isSelected = selected.has(dest.id);
              const isSent     = sentIds.has(dest.id);
              return (
                <button
                  key={dest.id}
                  type="button"
                  onClick={() => !isSent && toggle(dest.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors mb-0.5 text-left ${
                    isSent     ? 'bg-green-50 cursor-default' :
                    isSelected ? 'bg-brand-50 hover:bg-brand-100' :
                    'hover:bg-gray-100'
                  }`}
                >
                  {/* Avatar */}
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${dest.kind === 'group' ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-600'}`}>
                    {dest.kind === 'group' ? <Users size={16} /> : dest.label.charAt(0).toUpperCase()}
                  </div>
                  {/* Label */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{dest.label}</p>
                    <p className="text-[10px] text-gray-400">{dest.sub}</p>
                  </div>
                  {/* Tick */}
                  <div className="flex-shrink-0">
                    {isSent ? (
                      <CheckCircle2 size={18} className="text-green-500" />
                    ) : isSelected ? (
                      <div className="w-5 h-5 rounded-full bg-brand-600 flex items-center justify-center">
                        <Check size={12} className="text-white" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Error */}
        {error && (
          <p className="mx-4 mb-1 text-xs text-red-600 flex items-center gap-1">
            <AlertCircle size={12} /> {error}
          </p>
        )}

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between gap-3">
          <span className="text-xs text-gray-400">
            {selected.size > 0 ? `${selected.size} selected` : 'Select recipients'}
          </span>
          <button
            type="button"
            onClick={handleSend}
            disabled={selected.size === 0 || sending}
            className="flex items-center gap-2 px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Forward size={15} />
            )}
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
};

// In local dev, rewrite S3 URLs to go through the Vite /s3-proxy route (same-origin,
// bypasses CORS). In production there is no Vite proxy, so the original URL is used
// and the browser attempts a direct CORS fetch from S3.
function toProxiedUrl(url: string): string {
  const isLocalDev =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.startsWith('192.168.') ||
      window.location.hostname.startsWith('10.') ||
      window.location.hostname.startsWith('172.'));

  if (isLocalDev) {
    try {
      const parsed = new URL(url);
      if (parsed.hostname.endsWith('.amazonaws.com')) {
        return `/s3-proxy${parsed.pathname}${parsed.search}`;
      }
    } catch { /* not a valid absolute URL */ }
  }
  return url;
}

// Fetches the file as a Blob and triggers a native browser download.
// In local dev the request goes through the Vite /s3-proxy (no CORS issue).
// In production the request goes directly to S3 (requires S3 CORS to allow the
// production origin). If the fetch fails for any reason, falls back to opening
// the file in a new tab.
async function triggerDownload(url: string, fileName: string, _attachmentId?: number): Promise<void> {
  const fetchUrl = toProxiedUrl(url);
  try {
    const response = await fetch(fetchUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = fileName || 'download';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 15_000);
  } catch {
    // Fallback: open in new tab (user can save manually)
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

export const ChatSystem: React.FC<ChatSystemProps> = ({ currentUser, groups, messages, users, setMessages, setGroups }) => {
  const [activeGroup, setActiveGroup] = useState<ChatGroup | null>(null);
  const [activeUser, setActiveUser] = useState<User | null>(null); // For direct messaging
  const [input, setInput] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<Record<string, string>>({});
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [apiGroups, setApiGroups] = useState<Array<{group_id: number | string; name: string; description: string; created_at: string; last_message_at?: string; unseen_count?: number}>>([]);
  const [groupMembers, setGroupMembers] = useState<Record<string | number, string[]>>({});
  const [showMembersPanel, setShowMembersPanel] = useState(false);
  const [currentGroupMembers, setCurrentGroupMembers] = useState<Array<{participant_name: string}>>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [lastFetchedGroupId, setLastFetchedGroupId] = useState<number | null>(null);
  const fetchingRef = useRef<Record<number, boolean>>({});
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [selectedUserToAdd, setSelectedUserToAdd] = useState<string>('');
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [apiMessages, setApiMessages] = useState<Array<{
    sender: string;
    message: string;
    date: string;
    time: string;
    attachment_id?: number;
    attachment?: { id: number; type: string; file_name: string; url: string };
  }>>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  // ── Message delete state ───────────────────────────────────────────────────
  // Messages with an attachment_id are deleted via DELETE /messaging/attachments/{id}/.
  // Messages without one are removed from local state only (no server ID available).
  // We track which rows to hide using a composite key for both cases.
  const [deletedMsgKeys, setDeletedMsgKeys] = useState<Set<string>>(new Set());
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);
  const [deletingMsgKey, setDeletingMsgKey] = useState<string | null>(null);

  // ── Forward / Share state ─────────────────────────────────────────────────
  const [forwardMsg, setForwardMsg] = useState<string | null>(null); // message text/payload to forward
  const [showForwardModal, setShowForwardModal] = useState(false);

  // ── Attachment state ───────────────────────────────────────────────────────
  // A staged attachment lives here after the user picks it but before they hit Send.
  // On Send we POST the message text; the attachment data travels as a tagged payload.
  type StagedAttachment =
    | { kind: 'file'; file: File; preview: string | null; uploaded: UploadedFileAttachment | null; error: string | null }
    | { kind: 'link'; url: string; title: string; saved: LinkAttachment | null; error: string | null };

  const [stagedAttachment, setStagedAttachment] = useState<StagedAttachment | null>(null);
  const [isProcessingAttachment, setIsProcessingAttachment] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [directChats, setDirectChats] = useState<Record<string, string>>({}); // Map user ID/name to chat_id
  const [directChatUnseenCounts, setDirectChatUnseenCounts] = useState<Record<string, number>>({}); // Map user name (from "with") to unseen_count
  const [directChatUnseenByChatId, setDirectChatUnseenByChatId] = useState<Record<string, number>>({}); // chat_id -> unseen
  const [groupUnseenByGroupId, setGroupUnseenByGroupId] = useState<Record<string, number>>({}); // group_id -> unseen
  const [directChatLastMessageAt, setDirectChatLastMessageAt] = useState<Record<string, string>>({}); // Map user name (from "with") to last_message_at
  const [isStartingChat, setIsStartingChat] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [createGroupSearchQuery, setCreateGroupSearchQuery] = useState('');
  const { startOutgoingCall, startOutgoingGroupCall, wsSend } = useCallContext();
  const [showCallParticipantPicker, setShowCallParticipantPicker] = useState<'audio' | 'video' | null>(null);
  const [isInitiatingCall, setIsInitiatingCall] = useState(false);
  const callPickerRef = useRef<HTMLDivElement>(null);
  const groupCallPickerRef = useRef<HTMLDivElement>(null);
  const [showGroupCallPicker, setShowGroupCallPicker] = useState<'audio' | 'video' | null>(null);
  const [selectedGroupCallUserIds, setSelectedGroupCallUserIds] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null); // delay before sendTypingStop
  const typingExpireRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map()); // auto-hide received typing

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (callPickerRef.current && !callPickerRef.current.contains(e.target as Node)) {
        setShowCallParticipantPicker(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCallParticipantPicker]);

  useEffect(() => {
    if (!showGroupCallPicker) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (groupCallPickerRef.current && !groupCallPickerRef.current.contains(e.target as Node)) {
        setShowGroupCallPicker(null);
        setSelectedGroupCallUserIds(new Set());
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showGroupCallPicker]);

  // Permission: Can create group?
  const canCreateGroup = [UserRole.MD, UserRole.ADMIN, UserRole.HR, UserRole.TEAM_LEADER].includes(currentUser.role);

  // Get group ID as backend expects it (string like "G42366" or number)
  const getGroupId = (group: ChatGroup | null): string | number | null => {
    if (!group) return null;
    if (group.groupId != null && group.groupId !== '') return group.groupId;
    if (group.id) return group.id.startsWith('g') ? group.id.slice(1) : group.id;
    const apiGroupById = apiGroups.find(g => `g${g.group_id}` === group.id || String(g.group_id) === String(group.id?.replace(/^g/, '')));
    if (apiGroupById?.group_id != null) return apiGroupById.group_id;
    const apiGroupByName = apiGroups.find(g => group.name && (group.name === g.name || g.name === group.name));
    if (apiGroupByName?.group_id != null) return apiGroupByName.group_id;
    const matchingGroup = groups.find(g => g.id === group.id);
    if (matchingGroup?.groupId != null) return matchingGroup.groupId;
    return null;
  };

  // Helper to convert API group format to ChatGroup - supports group_id as string (e.g. "G83849") or number
  const convertApiGroupsToChatGroups = (rawGroups: any[], membersMap: Record<string | number, string[]>) =>
    rawGroups.map((g: any) => {
      const rawId = g.group_id ?? g.chat_id ?? g.id ?? g.groupId;
      const groupIdNum = rawId != null && typeof rawId === 'string' && /^\d+$/.test(rawId) ? parseInt(rawId, 10) : (typeof rawId === 'number' && !isNaN(rawId) ? rawId : NaN);
      const id = !isNaN(groupIdNum) ? groupIdNum : rawId;
      const groupId = !isNaN(groupIdNum) ? groupIdNum : rawId;
      const lookupKey = groupId ?? id;
      return {
        id: `g${id}`,
        name: g.group_name || g.name || '',
        members: membersMap[lookupKey] || membersMap[g.group_id] || membersMap[rawId] || [],
        createdBy: g.created_by || '',
        isPrivate: false,
        groupId,
        totalParticipant: typeof g.total_participant === 'number' ? g.total_participant : (g.total_participant != null ? Number(g.total_participant) : undefined),
        last_message_at: g.last_message_at,
        unseen_count: typeof g.unseen_count === 'number' ? g.unseen_count : (g.unseen_count != null ? Number(g.unseen_count) : 0),
      };
    });

  const chatResultRef = useRef<any>(null);

  // Fetch chats on mount; use shared users from props for chatMap (re-process when users updates)
  useEffect(() => {
    const load = async () => {
      setIsLoadingGroups(true);
      try {
        if (!chatResultRef.current) {
          chatResultRef.current = await apiLoadChats().catch((err) => {
            console.error('Error fetching chats:', err);
            return null;
          });
        }
        const chatResult = chatResultRef.current;

        if (chatResult) {
          const groups = chatResult.Group_info || [];
          const convertedGroups = convertApiGroupsToChatGroups(groups, groupMembers);
          const chats = chatResult.chats_info || [];
          const chatMap: Record<string, string> = {};
          const unseenMap: Record<string, number> = {};
          const directUnseenByChatId: Record<string, number> = {};
          const lastMsgMap: Record<string, string> = {};
          chats.forEach((chat: any) => {
            const chatWithRaw = chat.with;
            const chatWith = typeof chatWithRaw === 'string' ? chatWithRaw.trim() : '';
            let chatId = chat.chat_id ? String(chat.chat_id).trim() : '';
            const unseen = typeof chat.unseen_count === 'number' ? chat.unseen_count : (chat.unseen_count != null ? Number(chat.unseen_count) : 0);
            const lastMsgAt = chat.last_message_at || '';
            if (chatId) {
              directUnseenByChatId[chatId] = unseen;
              if (chatWith) {
                chatMap[chatWith] = chatId;
                unseenMap[chatWith] = unseen;
                if (lastMsgAt) lastMsgMap[chatWith] = lastMsgAt;
                const matchingUser = users.find((u: User) =>
                  u.name === chatWith || u.name === chatWithRaw || u.id === chatWith || String(u.id) === chatWith
                );
                if (matchingUser) {
                  chatMap[matchingUser.name] = chatId;
                  chatMap[matchingUser.id] = chatId;
                  unseenMap[matchingUser.name] = unseen;
                  if (lastMsgAt) lastMsgMap[matchingUser.name] = lastMsgAt;
                  if ((matchingUser as any).Employee_id) chatMap[(matchingUser as any).Employee_id] = chatId;
                }
              }
            }
          });
          const groupUnseenById: Record<string, number> = {};
          groups.forEach((g: any) => {
            const gid = g.group_id != null ? String(g.group_id).trim() : '';
            if (gid) {
              groupUnseenById[gid] = typeof g.unseen_count === 'number' ? g.unseen_count : (g.unseen_count != null ? Number(g.unseen_count) : 0);
            }
          });
          setDirectChats(prev => ({ ...prev, ...chatMap }));
          setDirectChatUnseenCounts(prev => ({ ...prev, ...unseenMap }));
          setDirectChatUnseenByChatId(prev => ({ ...prev, ...directUnseenByChatId }));
          setGroupUnseenByGroupId(prev => ({ ...prev, ...groupUnseenById }));
          setDirectChatLastMessageAt(prev => ({ ...prev, ...lastMsgMap }));
          setApiGroups(groups.map((g: any) => ({
            group_id: g.group_id,
            name: g.group_name || g.name || '',
            description: g.description || '',
            created_at: g.created_at || '',
          })));
          setGroups(convertedGroups);
          setActiveGroup((prev) => (prev ? prev : convertedGroups.length > 0 ? convertedGroups[0] : null));
        } else {
          try {
            const fallbackGroups = await apiShowCreatedGroups();
            const convertedGroups = convertApiGroupsToChatGroups(fallbackGroups, groupMembers);
            setApiGroups(fallbackGroups);
            setGroups(convertedGroups);
            setActiveGroup((prev) => (prev ? prev : convertedGroups.length > 0 ? convertedGroups[0] : null));
          } catch (fallbackErr: any) {
            console.error('Error fetching groups (fallback):', fallbackErr);
          }
        }
      } finally {
        setIsLoadingGroups(false);
      }
    };
    load();
  }, [users]);

  // Fetch group members when a group is selected (only once per group)
  useEffect(() => {
    if (!activeGroup || !(activeGroup as any).groupId) return;
    
    const groupId = (activeGroup as any).groupId;
    
    // Skip if already fetched or currently fetching
    if (groupMembers[groupId] && groupMembers[groupId].length > 0) {
      return;
    }
    
    if (fetchingRef.current[groupId]) {
      return; // Already fetching
    }
    
    const fetchMembers = async () => {
      fetchingRef.current[groupId] = true;
      try {
        const members = await apiShowGroupMembers(groupId);
        const memberNames = members.map(m => m.participant_name);
        setGroupMembers(prev => ({
          ...prev,
          [groupId]: memberNames
        }));
        
        // Update active group with members (only if still the same group)
        setActiveGroup(prev => {
          if (prev && (prev as any).groupId === groupId) {
            return {
              ...prev,
              members: memberNames
            };
          }
          return prev;
        });
      } catch (err: any) {
        // Silently fail - don't spam console
        // Error will be shown when user opens members panel
      } finally {
        fetchingRef.current[groupId] = false;
      }
    };
    
    fetchMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGroup?.id]); // Only depend on group ID, not the whole object

  // Fetch group members when members panel is opened
  useEffect(() => {
    // Only fetch if panel is open and we have a valid group
    if (!showMembersPanel || !activeGroup || !(activeGroup as any).groupId) {
      if (!showMembersPanel) {
        // Reset when panel closes
        setCurrentGroupMembers([]);
        setLastFetchedGroupId(null);
      }
      return;
    }

    const groupId = (activeGroup as any).groupId;
    
    // Prevent multiple calls for the same group
    if (isLoadingMembers) {
      return; // Already loading, skip
    }
    
    if (lastFetchedGroupId === groupId && currentGroupMembers.length > 0) {
      return; // Already fetched, skip
    }
    
    const fetchMembersForPanel = async () => {
      setIsLoadingMembers(true);
      setLastFetchedGroupId(groupId);
      
      try {
        const members = await apiShowGroupMembers(groupId);
        setCurrentGroupMembers(members);
      } catch (err: any) {
        // Only log error once, don't spam console
        if (lastFetchedGroupId !== groupId) {
          console.error('Error fetching group members:', err.message || 'Unknown error');
        }
        setCurrentGroupMembers([]);
        // Reset lastFetchedGroupId on error so it can retry if user closes and reopens
        setLastFetchedGroupId(null);
      } finally {
        setIsLoadingMembers(false);
      }
    };
    
    fetchMembersForPanel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMembersPanel, activeGroup?.id]); // Only depend on showMembersPanel and activeGroup.id

  // Use shared users from App (single source of truth)
  const availableEmployees = users;

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      alert('Please enter a group name');
      return;
    }

    if (Object.keys(selectedParticipants).length === 0) {
      alert('Please select at least one participant');
      return;
    }

    setIsCreatingGroup(true);
    try {
      const creatorId = getEmployeeIdFromUser(currentUser);
      const creatorName = currentUser.name || currentUser.id || '';
      const participants: Record<string, string> = {
        ...selectedParticipants,
        'tushar sir': '2000',
      };
      if (creatorId && creatorName) {
        participants[creatorName] = creatorId;
      }
      const groupData = {
        group_name: newGroupName.trim(),
        description: newGroupDescription.trim() || '',
        participants,
      };
      // Verify role is one of the allowed roles
      if (!canCreateGroup) {
        throw new Error('You do not have permission to create groups. Only MD, Admin, HR, and Team Leader can create groups.');
      }
      
      await apiCreateGroup(groupData);
      
      // Reset form
      setNewGroupName('');
      setNewGroupDescription('');
      setSelectedParticipants({});
      setCreateGroupSearchQuery('');
      setShowCreateModal(false);
      
      // Refresh groups using loadChats (shows only groups user is a member of)
      const chatData = await apiLoadChats();
      const groups = chatData.Group_info || [];
      
      // Convert API groups to ChatGroup format
      const convertedGroups: ChatGroup[] = groups.map((g: any) => ({
        id: `g${g.group_id}`,
        name: g.group_name || g.name || '',
        members: [],
        createdBy: g.created_by || '',
        isPrivate: false,
        groupId: g.group_id,
        totalParticipant: typeof g.total_participant === 'number' ? g.total_participant : (g.total_participant != null ? Number(g.total_participant) : undefined),
      }));
      
      // Also update apiGroups for compatibility
      const apiGroupsFormat = groups.map((g: any) => ({
        group_id: g.group_id,
        name: g.group_name || g.name || '',
        description: g.description || '',
        created_at: '',
      }));
      setApiGroups(apiGroupsFormat);
      
      // Update direct chats
      const chats = chatData.chats_info || [];
      const chatMap: Record<string, string> = {};
      const lastMsgMap: Record<string, string> = {};
      chats.forEach((chat: any) => {
        if (chat.with) {
          chatMap[chat.with] = chat.chat_id;
          if (chat.last_message_at) lastMsgMap[chat.with] = chat.last_message_at;
        }
      });
      setDirectChats(prev => ({ ...prev, ...chatMap }));
      setDirectChatLastMessageAt(prev => ({ ...prev, ...lastMsgMap }));
      
      setGroups(convertedGroups);
    } catch (err: any) {
      console.error('Error creating group:', err);
      alert(`Failed to create group: ${err.message || 'Unknown error'}`);
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const toggleParticipant = (userId: string, userName: string) => {
    setSelectedParticipants(prev => {
      const newParticipants = { ...prev };
      if (newParticipants[userName]) {
        delete newParticipants[userName];
      } else {
        newParticipants[userName] = userId;
      }
      return newParticipants;
    });
  };

  // Handle adding user to group
  const handleAddUserToGroup = async () => {
    const groupId = getGroupId(activeGroup);
    if (!groupId) {
      alert('Please select a group first');
      return;
    }

    if (!selectedUserToAdd) {
      alert('Please select a user to add');
      return;
    }

    setIsAddingUser(true);
    try {
      // Get the employee ID from the selected user
      const userToAdd = users.find(u => u.id === selectedUserToAdd);
      if (!userToAdd) {
        throw new Error('Selected user not found');
      }

      // Use employee ID (user.id should be the employee ID)
      const employeeId = userToAdd.id;

      await apiAddUserToGroup(groupId, employeeId);

      // Show success message
      alert('User added successfully!');

      // Reset form
      setSelectedUserToAdd('');
      setShowAddUserModal(false);

      // Refresh group members and employees
      if (groupId) {
        const members = await apiShowGroupMembers(groupId);
        setCurrentGroupMembers(members);
      }
    } catch (error: any) {
      console.error('❌ [ADD USER] Error:', error);
      alert(error.message || 'Failed to add user to group. Please try again.');
    } finally {
      setIsAddingUser(false);
    }
  };

  // Handle deleting user from group
  const handleDeleteUserFromGroup = async (userId: string, userName: string) => {
    const groupId = getGroupId(activeGroup);
    if (!groupId) {
      alert('Please select a group first');
      return;
    }

    // Check if user has permission (only group creator can delete)
    if (!canCreateGroup) {
      alert('Only group creators can delete users from the group');
      return;
    }

    // Confirm deletion
    if (!confirm(`Are you sure you want to remove ${userName} from this group?`)) {
      return;
    }

    try {
      const response = await apiDeleteUserFromGroup(groupId, userId);

      // Check response message
      if (response.Message) {
        if (response.Message.includes("deleted Successfully") || response.Message.includes("Successfully")) {
          alert('User removed successfully!');
          
          // Refresh group members and employees
          if (groupId) {
            const members = await apiShowGroupMembers(groupId);
            setCurrentGroupMembers(members);
          }
        } else {
          // Handle other messages (shouldn't happen on success, but just in case)
          alert(response.Message);
        }
      }
    } catch (error: any) {
      console.error('❌ [DELETE USER] Error:', error);
      
      // Show specific error messages
      const errorMessage = error.message || 'Failed to remove user from group. Please try again.';
      alert(errorMessage);
    }
  };

  // Handle deleting group
  const handleDeleteGroup = async () => {
    const groupId = getGroupId(activeGroup);
    if (!groupId) {
      alert('Please select a group first');
      return;
    }

    // Check if user has permission (only group creator can delete)
    if (!canCreateGroup) {
      alert('Only group creators (MD, Admin, HR, Team Lead) can delete groups');
      return;
    }

    // Confirm deletion
    if (!confirm(`Are you sure you want to delete the group "${activeGroup?.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await apiDeleteGroup(groupId);

      // Check response message
      if (response.message && response.message.includes("deleted successfully")) {
        alert('Group deleted successfully!');
        
        // Clear active group
        setActiveGroup(null);
        setShowMembersPanel(false);
        
        // Refresh groups list
        const chatData = await apiLoadChats();
        const groups = chatData.Group_info || [];
        
        // Convert API groups to ChatGroup format
        const convertedGroups: ChatGroup[] = groups.map((g: any) => ({
          id: `g${g.group_id}`,
          name: g.group_name || g.name || '',
          members: groupMembers[g.group_id] || [],
          createdBy: g.created_by || '',
          isPrivate: false,
          groupId: g.group_id,
          totalParticipant: g.total_participant,
          last_message_at: g.last_message_at,
          unseen_count: g.unseen_count ?? 0,
        }));
        
        // Update direct chats
        const chats = chatData.chats_info || [];
        const chatMap: Record<string, string> = {};
        const unseenMap: Record<string, number> = {};
        const directUnseenByChatId: Record<string, number> = {};
        const groupUnseenById: Record<string, number> = {};
        const lastMsgMap: Record<string, string> = {};
        groups.forEach((g: any) => {
          const gid = g.group_id != null ? String(g.group_id).trim() : '';
          if (gid) groupUnseenById[gid] = typeof g.unseen_count === 'number' ? g.unseen_count : (g.unseen_count != null ? Number(g.unseen_count) : 0);
        });
        chats.forEach((chat: any) => {
          const chatWith = typeof chat.with === 'string' ? chat.with.trim() : '';
          const chatId = chat.chat_id ? String(chat.chat_id).trim() : '';
          const unseen = typeof chat.unseen_count === 'number' ? chat.unseen_count : (chat.unseen_count != null ? Number(chat.unseen_count) : 0);
          if (chatId) {
            directUnseenByChatId[chatId] = unseen;
            if (chatWith) {
              chatMap[chatWith] = chatId;
              unseenMap[chatWith] = unseen;
              if (chat.last_message_at) lastMsgMap[chatWith] = chat.last_message_at;
            }
          }
        });
        setDirectChats(prev => ({ ...prev, ...chatMap }));
        setDirectChatUnseenCounts(prev => ({ ...prev, ...unseenMap }));
        setDirectChatUnseenByChatId(prev => ({ ...prev, ...directUnseenByChatId }));
        setGroupUnseenByGroupId(prev => ({ ...prev, ...groupUnseenById }));
        setDirectChatLastMessageAt(prev => ({ ...prev, ...lastMsgMap }));
        
        // Also update apiGroups for compatibility
        const apiGroupsFormat = groups.map((g: any) => ({
          group_id: g.group_id,
          name: g.group_name || g.name || '',
          description: g.description || '',
          created_at: g.created_at || '',
        }));
        
        setGroups(convertedGroups);
        setApiGroups(apiGroupsFormat);
      } else {
        alert(response.message || 'Group deleted successfully');
      }
    } catch (error: any) {
      console.error('❌ [DELETE GROUP] Error:', error);
      
      // Show specific error messages
      const errorMessage = error.message || 'Failed to delete group. Please try again.';
      alert(errorMessage);
    }
  };

  // Helper function to extract Employee_id from user object
  // CRITICAL: Preserve leading zeros (e.g., "00011" should stay "00011", not become "11")
  // DO NOT extract numeric part - preserve exact format from API
  const getEmployeeIdFromUser = (user: User): string | null => {
    // Priority 1: Check if user has Employee_id field (preserved from API)
    if ((user as any).Employee_id !== undefined && (user as any).Employee_id !== null) {
      const empId = String((user as any).Employee_id);
      return empId.trim();
    }
    if ((user as any)['Employee ID'] !== undefined && (user as any)['Employee ID'] !== null) {
      const empId = String((user as any)['Employee ID']);
      return empId.trim();
    }
    if (user.id !== undefined && user.id !== null) {
      const empId = String(user.id);
      return empId.trim();
    }
    return null;
  };

  // Helper function to find chat_id for a user — exact matches only to avoid wrong chat being loaded
  const findChatIdForUser = (user: User): string | null => {
    // Build a set of exact keys to look up
    const exactKeys: string[] = [
      user.name,
      String(user.id),
      (user as any).Employee_id != null ? String((user as any).Employee_id) : null,
      (user as any)['Employee ID'] != null ? String((user as any)['Employee ID']) : null,
    ].filter((k): k is string => k != null && k.trim() !== '');

    for (const key of exactKeys) {
      const chatId = directChats[key];
      if (chatId && typeof chatId === 'string' && chatId.trim() !== '') {
        return chatId;
      }
    }

    // Secondary pass: exact match against every directChats key
    for (const [chatKey, chatId] of Object.entries(directChats)) {
      if (chatId && typeof chatId === 'string' && chatId.trim() !== '') {
        if (
          chatKey === user.name ||
          chatKey === String(user.id) ||
          ((user as any).Employee_id != null && chatKey === String((user as any).Employee_id))
        ) {
          return chatId;
        }
      }
    }

    return null;
  };

  // Current chat ID for WebSocket subscription (group or DM)
  const currentChatId = activeGroup
    ? ((activeGroup as any).groupId ?? getGroupId(activeGroup))
    : activeUser
      ? findChatIdForUser(activeUser)
      : null;

  const currentChatIdRef = useRef<string | number | null>(null);
  currentChatIdRef.current = currentChatId;

  const matchChatId = (a: string | number | null | undefined, b: string | number | null | undefined): boolean => {
    if (a == null || b == null) return false;
    const sa = String(a).trim();
    const sb = String(b).trim();
    if (sa === sb) return true;
    const numA = sa.replace(/^[A-Za-z]+/, '');
    const numB = sb.replace(/^[A-Za-z]+/, '');
    if (numA && numB && numA === numB) return true;
    return false;
  };

  const {
    subscribe,
    unsubscribe,
    sendTypingStart,
    sendTypingStop,
    sendMarkSeen,
    isConnected: isChatWsConnected,
  } = useChatWebSocket({
    enabled: !!currentUser?.id,
    onNewMessage: (data: { chat_id: string | number; message?: any; payload?: any; sender?: string; text?: string }) => {
      const currentId = currentChatIdRef.current;
      const isCurrentChat = matchChatId(data.chat_id, currentId);
      if (!isCurrentChat) {
        // Message for another chat: increment unseen
        const cid = data.chat_id != null ? String(data.chat_id).trim() : '';
        if (cid) {
          const isGroup = /^G/i.test(cid); // Group IDs start with G (e.g. G83849), DMs with C (e.g. C67812849)
          if (isGroup) {
            setGroupUnseenByGroupId(prev => ({ ...prev, [cid]: (prev[cid] ?? 0) + 1 }));
          } else {
            setDirectChatUnseenByChatId(prev => ({ ...prev, [cid]: (prev[cid] ?? 0) + 1 }));
          }
        }
        return;
      }
      const m = data.message ?? (data as any).payload ?? (typeof data.message === 'string' ? { message: data.message, sender: data.sender } : data);
      if (!m) return;
      const content = typeof m === 'string' ? m : (m.message ?? m.text ?? '');
      const apiMsg = {
        id: typeof m === 'object' ? m.id : undefined,
        sender: typeof m === 'object' ? (m.sender_name ?? m.sender ?? '') : (data.sender ?? ''),
        message: content,
        date: typeof m === 'object' ? (m.date ?? new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '/')) : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '/'),
        time: typeof m === 'object' ? (m.time ?? new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })) : new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
        attachment_id: typeof m === 'object' ? m.attachment_id : undefined,
        attachment: typeof m === 'object' ? m.attachment : undefined,
      };
      setApiMessages((prev: any[]) => [...prev, apiMsg]);
    },
    // Chat list is loaded only on mount (when Messages tab opens) or site reload - not on every chat_updated
    onChatUpdated: () => {},
    onUserTyping: (data: { chat_id: string | number; user_id: string; user_name: string; is_typing: boolean }) => {
      if (!matchChatId(data.chat_id, currentChatIdRef.current)) return;
      const name = data.user_name;
      if (data.is_typing) {
        const prev = typingExpireRef.current.get(name);
        if (prev) clearTimeout(prev);
        typingExpireRef.current.set(
          name,
          setTimeout(() => {
            typingExpireRef.current.delete(name);
            setTypingUsers((p) => p.filter((u) => u !== name));
          }, 3000)
        );
        setTypingUsers((prev) => (prev.includes(name) ? prev : [...prev, name]));
      } else {
        const t = typingExpireRef.current.get(name);
        if (t) { clearTimeout(t); typingExpireRef.current.delete(name); }
        setTypingUsers((prev) => prev.filter((u) => u !== name));
      }
    },
  });

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingExpireRef.current.forEach((t) => clearTimeout(t));
      typingExpireRef.current.clear();
    };
  }, []);

  // Typing indicator: send typing_start when user types, typing_stop when idle (800ms after last keystroke)
  useEffect(() => {
    if (!currentChatId || !isChatWsConnected) return;
    if (input.trim()) {
      sendTypingStart(currentChatId);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        sendTypingStop(currentChatId);
        typingTimeoutRef.current = null;
      }, 800);
    } else {
      sendTypingStop(currentChatId);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    }
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    };
  }, [input, currentChatId, isChatWsConnected, sendTypingStart, sendTypingStop]);

  useEffect(() => {
    if (currentChatId && isChatWsConnected) {
      subscribe(currentChatId);
      sendMarkSeen(currentChatId);
      setTypingUsers([]);
      typingExpireRef.current.forEach((t) => clearTimeout(t));
      typingExpireRef.current.clear();
      const cid = String(currentChatId).trim();
      if (cid) {
        const isGroup = /^G/i.test(cid);
        if (isGroup) {
          setGroupUnseenByGroupId(prev => ({ ...prev, [cid]: 0 }));
        } else {
          setDirectChatUnseenByChatId(prev => ({ ...prev, [cid]: 0 }));
        }
      }
      return () => {
        unsubscribe(currentChatId);
        sendTypingStop(currentChatId);
      };
    }
  }, [currentChatId, isChatWsConnected, subscribe, unsubscribe, sendTypingStop, sendMarkSeen]);

  // Handle user click - open direct message
  const handleUserClick = async (user: User) => {
    const currentUserEmpId = getEmployeeIdFromUser(currentUser);
    if (user.id === currentUser.id) {
      return; // Don't allow messaging yourself
    }
    
    // Check if chat already exists - use improved lookup
    const existingChatId = findChatIdForUser(user);
    
    if (!existingChatId) {
      // Start a new chat
      setIsStartingChat(true);
      // Declare employeeId outside try block so it's accessible in catch block
      let employeeId: string | null = null;
      try {
        // Get employee ID of the CLICKED USER (target user, not current user)
        // This is the participant we want to start a chat with
        employeeId = getEmployeeIdFromUser(user);
        // Validate employeeId
        if (!employeeId || employeeId === '') {
          // Try to find employee ID from users (already loaded)
          const foundInAll = users.find((emp) =>
            emp.name === user.name ||
            emp.email === user.email ||
            String(emp.id) === String(user.id) ||
            (emp as any).Employee_id === String(user.id)
          );
          if (foundInAll) {
            const eid = getEmployeeIdFromUser(foundInAll);
            if (eid) employeeId = eid;
          }
          if (!employeeId || employeeId === '') {
            throw new Error(`Unable to determine Employee ID for user "${user.name}".\n\nPlease ensure:\n1. The user exists in the system\n2. The user has a valid Employee ID\n3. Contact support if the issue persists`);
          }
        }
        
        // Additional validation - ensure Employee_id is not just whitespace or invalid
        employeeId = employeeId.trim();
        if (employeeId.length === 0 || employeeId === 'undefined' || employeeId === 'null') {
          throw new Error(`Invalid Employee ID for user "${user.name}". Employee ID cannot be empty.`);
        }
        
        // CRITICAL: Verify the Employee_id exists in availableEmployees before sending
        // If not found, try to find the correct Employee_id by matching name/email
        let employeeExists = availableEmployees.find(emp => {
          const empId = getEmployeeIdFromUser(emp);
          return empId === employeeId || emp.id === employeeId || (emp as any).Employee_id === employeeId;
        });
        
        if (!employeeExists) {
          // Try to find the user by name or email to get the correct Employee_id
          const foundByMatch = availableEmployees.find(emp => {
            const empName = emp.name?.toLowerCase().trim();
            const empEmail = emp.email?.toLowerCase().trim();
            const targetName = user.name?.toLowerCase().trim();
            const targetEmail = user.email?.toLowerCase().trim();
            
            return (empName && targetName && empName === targetName) ||
                   (empEmail && targetEmail && empEmail === targetEmail) ||
                   (emp.id === user.id);
          });
          
          if (foundByMatch) {
            const correctEmployeeId = getEmployeeIdFromUser(foundByMatch);
            if (correctEmployeeId && correctEmployeeId !== employeeId) {
              console.error("❌ [CHAT SYSTEM] MISMATCH DETECTED!");
              console.error("❌ [CHAT SYSTEM] Wrong Employee_id being used:", employeeId);
              console.error("❌ [CHAT SYSTEM] Correct Employee_id should be:", correctEmployeeId);
              console.error("❌ [CHAT SYSTEM] User name:", user.name);
              console.error("❌ [CHAT SYSTEM] This is why the backend returns 'Invalid User' error!");
              
              // Use the correct Employee_id
              employeeId = correctEmployeeId;
              employeeExists = foundByMatch;
            } else if (correctEmployeeId) {
              employeeExists = foundByMatch;
            }
          } else {
            // Still not found - show detailed error
            console.error("❌ [CHAT SYSTEM] User not found in availableEmployees at all!");
            console.error("❌ [CHAT SYSTEM] Available employees:", 
              availableEmployees.map(e => ({ 
                id: e.id, 
                Employee_id: (e as any).Employee_id, 
                name: e.name,
                email: e.email
              }))
            );
            console.error("❌ [CHAT SYSTEM] Trying to use Employee_id:", employeeId);
            console.error("❌ [CHAT SYSTEM] This Employee_id may not exist in the backend database!");
          }
        }
        // Final validation before sending
        if (!employeeId || employeeId.trim() === '' || employeeId === 'undefined' || employeeId === 'null') {
          throw new Error(
            `Invalid Employee ID: Cannot start chat with "${user.name}".\n\n` +
            `The Employee ID is missing or invalid.\n\n` +
            `Please contact support to verify:\n` +
            `1. User "${user.name}" exists in the system\n` +
            `2. User has a valid Employee ID\n` +
            `3. Employee ID is correctly stored in the database`
          );
        }
        
        // Warn if we couldn't verify the Employee_id exists
        if (!employeeExists) {
          console.error("⚠️ [CHAT SYSTEM] WARNING: Proceeding with unverified Employee_id:", employeeId);
          console.error("⚠️ [CHAT SYSTEM] This may cause 'Invalid User' error from backend if the ID doesn't exist.");
        }
        
        const startChatResponse = await apiStartChat(employeeId);
        // After starting chat, reload chats to get the new chat_id
        // Wait a bit to ensure backend has processed the new chat
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Reload chats multiple times if needed to get the chat_id (2 retries, longer delay)
        let chatIdFound = false;
        let retryCount = 0;
        const maxRetries = 2;
        
        while (!chatIdFound && retryCount < maxRetries) {
          try {
            const chatData = await apiLoadChats();
            const chats = chatData.chats_info || [];
            const chatMap: Record<string, string> = {};
            const lastMsgMap: Record<string, string> = {};
            
            chats.forEach((chat: any) => {
              const chatWith = chat.with || '';
              const chatId = chat.chat_id || '';
              
              if (chatWith && chatId) {
                chatMap[chatWith] = chatId;
                if (chat.last_message_at) lastMsgMap[chatWith] = chat.last_message_at;

                // Exact-match only to avoid cross-user contamination
                const matchesUser =
                  chatWith === user.name ||
                  chatWith === String(user.id) ||
                  (employeeId != null && chatWith === employeeId);

                if (matchesUser) {
                  chatMap[user.name] = chatId;
                  chatMap[String(user.id)] = chatId;
                  if (employeeId) chatMap[employeeId] = chatId;
                  if ((user as any).Employee_id) {
                    chatMap[String((user as any).Employee_id)] = chatId;
                  }
                  if (chat.last_message_at) {
                    lastMsgMap[user.name] = chat.last_message_at;
                  }
                }
              }
            });
            
            setDirectChats(prev => ({ ...prev, ...chatMap }));
            setDirectChatLastMessageAt(prev => ({ ...prev, ...lastMsgMap }));
            
            // Verify we now have a chat_id for this user
            const newChatId = findChatIdForUser(user);
            if (newChatId && newChatId.trim() !== '') {
              chatIdFound = true;
            } else {
              retryCount++;
              if (retryCount < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 1500));
              }
            }
          } catch (reloadError) {
            console.error('Error reloading chats:', reloadError);
            retryCount++;
            if (retryCount < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 1500));
            }
          }
        }
        
        if (!chatIdFound) {
          // Still set active user - the chat_id might be available when they try to send a message
        }
        
        // Set active user
        setActiveUser(user);
        setActiveGroup(null);
      } catch (error: any) {
        console.error('❌ [CHAT SYSTEM] Error starting chat:', error);
        console.error('❌ [CHAT SYSTEM] Error details:', {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status
        });
        
        // Show user-friendly error message
        let errorMessage = 'Failed to start chat. ';
        
        // Handle 404 errors - backend might return 404 with "Invalid User" for permission issues
        if (error.response?.status === 404 || error.message?.includes('404') || error.message?.includes('not found')) {
          const errorData = error.response?.data;
          const backendErrorMsg = typeof errorData === 'string' ? errorData : (errorData?.message || errorData?.detail || '');
          
          if (error.message?.includes('Invalid User') || error.message?.toLowerCase().includes('invalid user') || 
              backendErrorMsg?.toLowerCase().includes('invalid user')) {
            const empIdForError = employeeId || user.id || 'unknown';
            const empIdType = employeeId ? typeof employeeId : 'unknown';
            const empIdLength = employeeId ? employeeId.length : 0;
            errorMessage = 
              `Invalid User: Unable to start chat with Employee ID "${empIdForError}".\n\n` +
              `⚠️ IMPORTANT: This API should work for ALL roles (MD, Admin, TeamLead, Employee, Intern).\n\n` +
              `🔍 What we're sending to backend:\n` +
              `   Employee_id: "${empIdForError}" (type: ${empIdType}, length: ${empIdLength})\n` +
              `   Request: { "participant": "${empIdForError}" }\n\n` +
              `❌ Possible causes:\n` +
              `1. Employee ID "${empIdForError}" doesn't exist in backend database\n` +
              `2. Backend converted Employee_id to number (lost leading zeros) - check backend logs\n` +
              `3. Backend has permission restrictions for your role (${currentUser.role})\n` +
              `4. Backend endpoint validation is rejecting the Employee_id format\n` +
              `5. Your authentication token may have expired\n\n` +
              `✅ Please try:\n` +
              `1. Check browser console for detailed logs (F12 → Console tab)\n` +
              `2. Verify Employee ID "${empIdForError}" exists in the system\n` +
              `3. Log out and log back in to refresh your session\n` +
              `4. Contact backend developer to check:\n` +
              `   - If Employee_id "${empIdForError}" exists in database\n` +
              `   - If backend is preserving Employee_id as string (not converting to number)\n` +
              `   - If backend permissions allow your role (${currentUser.role}) to start chats`;
          } else {
            errorMessage = error.message || 
              `Endpoint not found (404). The messaging service may not be available.\n\n` +
              `Please check:\n` +
              `1. The backend server is running\n` +
              `2. Your network connection is working\n` +
              `3. Try refreshing the page and logging in again`;
          }
        } else if (error.response?.status === 403 || error.message?.includes('403') || error.message?.includes('Permission Denied')) {
          errorMessage = error.message || 
            `Permission Denied (403): You don't have permission to start a chat.\n\n` +
            `Possible reasons:\n` +
            `1. Your session may have expired - try logging out and back in\n` +
            `2. You may not have permission to start chats\n` +
            `3. The Employee ID may be restricted\n` +
            `4. Please contact your administrator`;
        } else if (error.message) {
          if (error.message.includes('Invalid') || error.message.includes('required')) {
            errorMessage = error.message;
          } else if (error.message.includes('Permission Denied') || error.message.includes('403')) {
            errorMessage = error.message;
          } else {
            errorMessage += error.message;
          }
        } else {
          errorMessage += 'Please try again.';
        }
        
        alert(errorMessage);
      } finally {
        setIsStartingChat(false);
      }
    } else {
      setActiveUser(user);
      setActiveGroup(null);
    }
  };
  
  // Handle group click - open group chat
  const handleGroupClick = (group: ChatGroup) => {
    setActiveGroup(group);
    setActiveUser(null); // Clear active user when selecting group
  };

  // Fetch messages from API when active group or user changes
  useEffect(() => {
    // Clear stale messages immediately so the previous chat's messages never
    // flash while the new chat's messages are loading.
    setApiMessages([]);
    setDeletedMsgKeys(new Set());
    setConfirmDeleteKey(null);
    setDeletingMsgKey(null);

    const fetchMessages = async () => {
      if (!activeGroup && !activeUser) {
        return;
      }

      setIsLoadingMessages(true);
      try {
        let chatId: number | string;
        
        if (activeGroup && (activeGroup as any).groupId) {
          // For groups: chat_id = group_id from /messaging/loadChats/ response
          // Format: "G09381" (with 'G' prefix) - use as-is, don't extract numeric
          chatId = (activeGroup as any).groupId;
        } else if (activeUser) {
          chatId = findChatIdForUser(activeUser) || '';
          if (!chatId || chatId.trim() === '') {
            // Try to reload chats in case it was just created
            try {
              const chatData = await apiLoadChats();
              const chats = chatData.chats_info || [];
              const chatMap: Record<string, string> = {};
              const lastMsgMap: Record<string, string> = {};
              chats.forEach((chat: any) => {
                if (chat.with && chat.chat_id) {
                  chatMap[chat.with] = chat.chat_id;
                  if (chat.last_message_at) lastMsgMap[chat.with] = chat.last_message_at;
                  // Exact-match only
                  if (
                    chat.with === activeUser.name ||
                    chat.with === String(activeUser.id)
                  ) {
                    chatMap[activeUser.name] = chat.chat_id;
                    chatMap[String(activeUser.id)] = chat.chat_id;
                    if (chat.last_message_at) lastMsgMap[activeUser.name] = chat.last_message_at;
                  }
                }
              });
              setDirectChats(prev => ({ ...prev, ...chatMap }));
              setDirectChatLastMessageAt(prev => ({ ...prev, ...lastMsgMap }));
              
              // Try lookup again
              chatId = findChatIdForUser(activeUser) || '';
              if (!chatId || chatId.trim() === '') {
                setApiMessages([]);
                setIsLoadingMessages(false);
                return;
              }
            } catch (reloadError) {
              console.error('Error reloading chats:', reloadError);
              setApiMessages([]);
              setIsLoadingMessages(false);
              return;
            }
          }
        } else {
          return;
        }

        // Validate chatId before using it
        if (!chatId || (typeof chatId === 'string' && chatId.trim() === '')) {
          setApiMessages([]);
          setIsLoadingMessages(false);
          return;
        }

        const fetchedMessages = await apiGetMessages(chatId);
        setApiMessages(fetchedMessages || []);
      } catch (error: any) {
        console.error('Error fetching messages:', error);
        // Even if there's an error, set empty array to allow UI to continue
        setApiMessages([]);
      } finally {
        setIsLoadingMessages(false);
      }
    };

    fetchMessages();
  }, [activeGroup, activeUser, currentUser.id, directChats]);

  // Auto-scroll to bottom when messages change (after sorting, latest messages are at bottom)
  useEffect(() => {
    // Use setTimeout to ensure DOM has updated after sorting
    const scrollToBottom = () => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      }
    };
    
    // Scroll immediately and also after a small delay to handle async rendering
    scrollToBottom();
    const timeoutId = setTimeout(scrollToBottom, 100);
    
    return () => clearTimeout(timeoutId);
  }, [apiMessages]);

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showEmojiPicker && !target.closest('.emoji-picker-container')) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showEmojiPicker]);

  // Update handleSend to use API
  // ── Attachment helpers ─────────────────────────────────────────────────────

  // ── Forward / Share helpers ────────────────────────────────────────────────
  const openForwardModal = (msgText: string) => {
    setForwardMsg(msgText);
    setShowForwardModal(true);
  };
  const closeForwardModal = () => {
    setForwardMsg(null);
    setShowForwardModal(false);
  };

  const clearAttachment = () => {
    setStagedAttachment(null);
    setShowLinkInput(false);
    setLinkUrl('');
    setLinkTitle('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

  const processAndStageFile = async (file: File) => {
    if (file.size > MAX_FILE_BYTES) {
      setStagedAttachment({
        kind: 'file',
        file,
        preview: null,
        uploaded: null,
        error: `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum allowed size is 10 MB.`,
      });
      return;
    }
    const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
    setStagedAttachment({ kind: 'file', file, preview, uploaded: null, error: null });
    setIsProcessingAttachment(true);
    try {
      const uploaded = await apiUploadFile(file);
      setStagedAttachment((prev) =>
        prev?.kind === 'file' ? { ...prev, uploaded, error: null } : prev,
      );
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Upload failed';
      setStagedAttachment((prev) =>
        prev?.kind === 'file' ? { ...prev, error: msg } : prev,
      );
    } finally {
      setIsProcessingAttachment(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = '';
    await processAndStageFile(file);
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const files = e.clipboardData?.files;
    if (!files?.length || stagedAttachment || isProcessingAttachment) return;
    const file = files[0];
    e.preventDefault();
    await processAndStageFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    if (!stagedAttachment && !isProcessingAttachment) setIsDraggingOver(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDraggingOver(false);
  };
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    const files = e.dataTransfer?.files;
    if (!files?.length || stagedAttachment || isProcessingAttachment) return;
    await processAndStageFile(files[0]);
  };

  const handleAddLink = async () => {
    const trimUrl = linkUrl.trim();
    if (!trimUrl) return;
    // basic URL guard
    if (!/^https?:\/\//i.test(trimUrl)) {
      setStagedAttachment({ kind: 'link', url: trimUrl, title: linkTitle.trim(), saved: null, error: 'URL must start with http:// or https://' });
      return;
    }
    setStagedAttachment({ kind: 'link', url: trimUrl, title: linkTitle.trim(), saved: null, error: null });
    setIsProcessingAttachment(true);
    setShowLinkInput(false);
    try {
      const saved = await apiAddLink(trimUrl, linkTitle.trim() || undefined);
      setStagedAttachment((prev) =>
        prev?.kind === 'link' ? { ...prev, saved, error: null } : prev,
      );
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to save link';
      setStagedAttachment((prev) =>
        prev?.kind === 'link' ? { ...prev, error: msg } : prev,
      );
    } finally {
      setIsProcessingAttachment(false);
    }
  };

  const handleDeleteStagedAttachment = async () => {
    if (!stagedAttachment) return;

    const id =
      stagedAttachment.kind === 'file' ? stagedAttachment.uploaded?.id :
      stagedAttachment.kind === 'link' ? stagedAttachment.saved?.id : undefined;

    if (id) {
      try {
        await apiDeleteAttachment(id);
      } catch (err: any) {
        const msg: string = err?.message || 'Failed to delete attachment.';

        // 400 – already sent: clear locally, warn user
        if (msg.includes('already sent')) {
          if (stagedAttachment.kind === 'file' && stagedAttachment.preview) {
            URL.revokeObjectURL(stagedAttachment.preview);
          }
          clearAttachment();
          return;
        }

        // 403 – not allowed: show error in tray, don't clear
        if (msg.includes('not allowed') || msg.includes('Not allowed')) {
          setStagedAttachment((prev) => prev ? { ...prev, error: msg } : prev);
          return;
        }

        // 404 – already gone: clear locally, no complaint needed
        if (msg.includes('not found') || msg.includes('Not found')) {
          if (stagedAttachment.kind === 'file' && stagedAttachment.preview) {
            URL.revokeObjectURL(stagedAttachment.preview);
          }
          clearAttachment();
          return;
        }

        // Unknown error: show in tray
        setStagedAttachment((prev) => prev ? { ...prev, error: msg } : prev);
        return;
      }
    }

    // Revoke object URL if image preview exists
    if (stagedAttachment.kind === 'file' && stagedAttachment.preview) {
      URL.revokeObjectURL(stagedAttachment.preview);
    }
    clearAttachment();
  };

  const handleSend = async () => {
    if (!input.trim() && !stagedAttachment) return;
    if (isSendingMessage || isProcessingAttachment) return;
    
    let chatId: number | string;
    
    if (activeGroup && (activeGroup as any).groupId) {
      // For groups: chat_id = group_id from /messaging/loadChats/ response
      // Format: "G09381" (with 'G' prefix) - use as-is, don't extract numeric
      chatId = (activeGroup as any).groupId;
    } else if (activeUser) {
      chatId = findChatIdForUser(activeUser) || '';
      if (!chatId || chatId.trim() === '') {
        // Try to reload chats and find chat_id - retry multiple times
        let chatIdFound = false;
        let retryCount = 0;
        const maxRetries = 2;
        
        while (!chatIdFound && retryCount < maxRetries) {
          try {
            const chatData = await apiLoadChats();
            const chats = chatData.chats_info || [];
            const chatMap: Record<string, string> = {};
            const lastMsgMap: Record<string, string> = {};
            
            chats.forEach((chat: any) => {
              const chatWith = chat.with || '';
              const chatIdValue = chat.chat_id || '';

              if (chatWith && chatIdValue) {
                chatMap[chatWith] = chatIdValue;
                if (chat.last_message_at) lastMsgMap[chatWith] = chat.last_message_at;

                // Exact-match only
                if (
                  chatWith === activeUser.name ||
                  chatWith === String(activeUser.id)
                ) {
                  chatMap[activeUser.name] = chatIdValue;
                  chatMap[String(activeUser.id)] = chatIdValue;
                  if (chat.last_message_at) lastMsgMap[activeUser.name] = chat.last_message_at;
                  if ((activeUser as any).Employee_id) {
                    chatMap[String((activeUser as any).Employee_id)] = chatIdValue;
                  }
                }
              }
            });

            setDirectChats(prev => ({ ...prev, ...chatMap }));
            setDirectChatLastMessageAt(prev => ({ ...prev, ...lastMsgMap }));
            
            // Try to find chat_id again
            chatId = findChatIdForUser(activeUser) || '';
            if (chatId && chatId.trim() !== '') {
              chatIdFound = true;
            } else {
              retryCount++;
              if (retryCount < maxRetries) await new Promise(resolve => setTimeout(resolve, 1000));
            }
          } catch (reloadError) {
            console.error('Error reloading chats:', reloadError);
            retryCount++;
            if (retryCount < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        }
        
        if (!chatId || chatId.trim() === '') {
          alert('Chat not found. The chat may not have been created yet. Please:\n\n1. Click on the user again to start the chat\n2. Wait a moment for the chat to be created\n3. Try sending a message again');
          return;
        }
      }
    } else {
      return; // No active conversation
    }

    // Validate chatId before using it
    if (!chatId || (typeof chatId === 'string' && chatId.trim() === '')) {
      alert('Invalid chat ID. Please try selecting the conversation again.');
      return;
    }

    const messageText = input.trim();
    setIsSendingMessage(true);
    
    try {
      if (!chatId || (typeof chatId === 'string' && chatId.trim() === '')) {
        if (activeUser) {
          const chatData = await apiLoadChats();
          const chats = chatData.chats_info || [];
          const chatMap: Record<string, string> = {};
          const lastMsgMap: Record<string, string> = {};
          chats.forEach((chat: any) => {
            if (chat.with && chat.chat_id) {
              chatMap[chat.with] = chat.chat_id;
              if (chat.last_message_at) lastMsgMap[chat.with] = chat.last_message_at;
              // Exact-match only
              if (chat.with === activeUser.name || chat.with === String(activeUser.id)) {
                chatMap[activeUser.name] = chat.chat_id;
                chatMap[String(activeUser.id)] = chat.chat_id;
                if (chat.last_message_at) lastMsgMap[activeUser.name] = chat.last_message_at;
              }
            }
          });
          setDirectChats(prev => ({ ...prev, ...chatMap }));
          setDirectChatLastMessageAt(prev => ({ ...prev, ...lastMsgMap }));
          chatId = findChatIdForUser(activeUser) || chatId;
          
          if (!chatId || (typeof chatId === 'string' && chatId.trim() === '')) {
            alert('Chat not found. Please click on the user again to start the chat.');
            return;
          }
        }
      }
      
      // ── Send message (with optional attachment) ───────────────────────────
      if (stagedAttachment) {
        if (stagedAttachment.kind === 'file' && stagedAttachment.uploaded) {
          // Use the proper API format: { Message, attachment_ids: [id] }
          const attachmentId = stagedAttachment.uploaded.id;
          const text = messageText || stagedAttachment.uploaded.file_name;
          await apiPostMessages(chatId, text, [attachmentId]);
        } else if (stagedAttachment.kind === 'link' && (stagedAttachment.saved || stagedAttachment.url)) {
          // Links are sent as a tagged string (no attachment_id from the API)
          const url   = stagedAttachment.saved?.url   ?? stagedAttachment.url;
          const title = stagedAttachment.saved?.title ?? stagedAttachment.title ?? url;
          await apiPostMessages(chatId, `[LINK:${title}|${url}]`);
          // Also send text if the user typed something alongside the link
          if (messageText) await apiPostMessages(chatId, messageText);
        }
        clearAttachment();
      } else if (messageText) {
        // ── Plain text message ──────────────────────────────────────────────
        await apiPostMessages(chatId, messageText);
      }

      // Clear input immediately for better UX
      setInput('');
      
      // Wait a moment for the backend to save the message
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const fetchedMessages = await apiGetMessages(chatId);
      if (fetchedMessages && fetchedMessages.length > 0) {
        setApiMessages(fetchedMessages);
      } else {
        setApiMessages([]);
      }
      
      // Auto-scroll will happen via useEffect when apiMessages updates
      
      // Reload chats to ensure we have the latest chat_id
      if (activeUser) {
        const chatData = await apiLoadChats();
        const chats = chatData.chats_info || [];
        const chatMap: Record<string, string> = {};
        const lastMsgMap: Record<string, string> = {};
        chats.forEach((chat: any) => {
          const chatWith = chat.with || '';
          const chatId = chat.chat_id || '';
          
          if (chatWith && chatId) {
            chatMap[chatWith] = chatId;
            if (chat.last_message_at) lastMsgMap[chatWith] = chat.last_message_at;
            
            // Exact-match only
            if (chatWith === activeUser.name || chatWith === String(activeUser.id)) {
              chatMap[activeUser.name] = chatId;
              chatMap[String(activeUser.id)] = chatId;
              if (chat.last_message_at) lastMsgMap[activeUser.name] = chat.last_message_at;
            }
          }
        });
        setDirectChats(prev => ({ ...prev, ...chatMap }));
        setDirectChatLastMessageAt(prev => ({ ...prev, ...lastMsgMap }));
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      alert(error.message || 'Failed to send message. Please try again.');
    } finally {
      setIsSendingMessage(false);
    }
  };

  const hasActiveChat = !!(activeGroup || activeUser);

  // Parse API date format "DD/MM/YY HH:MM:SS" into a numeric timestamp for sorting
  const parseApiDate = (dateStr: string | undefined): number => {
    if (!dateStr) return 0;
    try {
      // Format: "02/03/26 11:06:20" → DD/MM/YY HH:MM:SS
      const [datePart, timePart] = dateStr.trim().split(' ');
      if (!datePart) return 0;
      const [dd, mm, yy] = datePart.split('/');
      const [hh, min, ss] = (timePart || '00:00:00').split(':');
      const fullYear = 2000 + parseInt(yy, 10);
      return new Date(fullYear, parseInt(mm, 10) - 1, parseInt(dd, 10), parseInt(hh, 10), parseInt(min, 10), parseInt(ss, 10)).getTime();
    } catch {
      return 0;
    }
  };

  // Filter groups and users by search query, then sort by latest message first
  const searchLower = searchQuery.trim().toLowerCase();
  const filteredGroups = (searchLower
    ? groups.filter((g) => (g.name || '').toLowerCase().includes(searchLower))
    : groups
  ).slice().sort((a, b) => parseApiDate(b.last_message_at) - parseApiDate(a.last_message_at));

  const filteredUsers = (searchLower
    ? users.filter(
        (u) =>
          (u.name || '').toLowerCase().includes(searchLower) ||
          (u.email || '').toLowerCase().includes(searchLower) ||
          (u.id || '').toLowerCase().includes(searchLower)
      )
    : users
  ).slice().sort((a, b) => {
    const aTime = parseApiDate(directChatLastMessageAt[a.name] || directChatLastMessageAt[String(a.id)]);
    const bTime = parseApiDate(directChatLastMessageAt[b.name] || directChatLastMessageAt[String(b.id)]);
    return bTime - aTime;
  });

  return (
    <div className="flex h-[calc(100vh-140px)] sm:h-[calc(100vh-140px)] min-h-[400px] bg-white rounded-xl sm:rounded-2xl shadow-sm overflow-hidden border border-gray-200">
      {/* Sidebar List - full width on mobile when no chat; hidden when chat open */}
      <div className={`${hasActiveChat ? 'hidden sm:flex' : 'flex'} w-full sm:w-1/3 border-r border-gray-200 flex-col bg-gray-50/50 shrink-0`}>
        <div className="p-3 sm:p-4 border-b border-gray-200 flex justify-between items-center bg-white">
          <h3 className="font-bold text-gray-800 text-base sm:text-lg">Messages</h3>
          {canCreateGroup && (
             <button onClick={() => setShowCreateModal(true)} title="New Group" className="text-white bg-brand-600 hover:bg-brand-700 p-2 rounded-lg shadow-sm transition-colors">
               <PlusCircle size={20} />
             </button>
          )}
        </div>
        <div className="px-2 pt-2 pb-1 border-b border-gray-100">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search groups or users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 bg-gray-50 focus:bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {/* Groups Section */}
          <div className="space-y-1">
            {isLoadingGroups ? (
              <div className="text-center text-gray-400 py-8">Loading groups...</div>
            ) : filteredGroups.length === 0 ? (
              <div className="text-center text-gray-400 py-8">
                {searchQuery ? 'No groups match your search' : 'No groups yet'}
              </div>
            ) : (
              filteredGroups.map(group => (
            <div 
              key={group.id} 
                  onClick={() => handleGroupClick(group)}
                  className={`p-2 sm:p-3 cursor-pointer rounded-lg sm:rounded-xl transition-all ${activeGroup?.id === group.id ? 'bg-white shadow-md border border-gray-100' : 'hover:bg-gray-100 text-gray-600'}`}
            >
                <div className="flex items-center space-x-3">
                 <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white font-bold shadow-sm shrink-0 ${group.isPrivate ? 'bg-indigo-500' : 'bg-brand-500'}`}>
                   {group.isPrivate ? <Users size={16} className="sm:w-[18px] sm:h-[18px]" /> : <Hash size={16} className="sm:w-[18px] sm:h-[18px]" />}
                 </div>
                 <div className="min-w-0 flex-1">
                       <p className={`font-semibold text-xs sm:text-sm truncate ${activeGroup?.id === group.id ? 'text-gray-900' : 'text-gray-700'}`}>{group.name}</p>
                       <p className="text-xs text-gray-400">
                         {(() => {
                           const gid = (group as any).groupId ?? getGroupId(group);
                           const actualCount = (gid != null && groupMembers[gid] ? groupMembers[gid].length : null)
                             ?? (group.members?.length ?? null);
                           const count = actualCount ?? group.totalParticipant;
                           return count != null ? `${count} members` : 'Loading members...';
                         })()}
                       </p>
                     </div>
                 {(() => {
                   const gid = (group as any).groupId ?? getGroupId(group);
                   const unseen = gid != null ? (groupUnseenByGroupId[String(gid)] ?? group.unseen_count ?? 0) : (group.unseen_count ?? 0);
                   return unseen > 0 ? (
                     <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-semibold shrink-0">
                       {unseen > 99 ? '99+' : unseen}
                     </span>
                   ) : null;
                 })()}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* All Users Section */}
          <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-200">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider px-2 sm:px-3 mb-2">All Users</h4>
            {filteredUsers.length === 0 ? (
              <div className="text-center text-gray-400 py-4 text-sm">
                {searchQuery ? 'No users match your search' : 'No users found'}
              </div>
            ) : (
              <div className="space-y-1">
                {filteredUsers.map(user => {
                  // Create DM channel ID for highlighting
                  const userIds = [currentUser.id, user.id].sort();
                  const dmChannelId = `dm-${userIds[0]}-${userIds[1]}`;
                  const hasMessages = messages.some(m => m.channelId === dmChannelId);
                  const isActive = activeUser?.id === user.id;
                  
                  return (
                    <div
                      key={user.id}
                      onClick={() => handleUserClick(user)}
                      className={`p-1.5 sm:p-2 cursor-pointer rounded-lg transition-colors ${
                        isActive 
                          ? 'bg-white shadow-md border border-gray-100' 
                          : 'hover:bg-gray-100'
                      }`}
                    >
                    <div className="flex items-center space-x-2">
                      <img
                        src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`}
                        alt={user.name}
                        className="w-8 h-8 rounded-full object-cover border border-gray-200"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          if (!target.src.includes('ui-avatars.com')) {
                            target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random`;
                          }
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${isActive ? 'text-gray-900' : 'text-gray-700'}`}>
                          {user.name}
                          {user.id === currentUser.id && (
                            <span className="ml-2 text-xs text-gray-500">(You)</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{user.email || user.designation || user.role}</p>
                      </div>
                      {(() => {
                        const chatId = findChatIdForUser(user);
                        const unseen = chatId ? (directChatUnseenByChatId[chatId] ?? directChatUnseenCounts[user.name] ?? 0) : (directChatUnseenCounts[user.name] ?? 0);
                        return unseen > 0 ? (
                          <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-semibold shrink-0">
                            {unseen > 99 ? '99+' : unseen}
                          </span>
                        ) : null;
                      })()}
                    </div>
                 </div>
                  );
                })}
              </div>
            )}
            </div>
        </div>
      </div>

      {/* Chat Area */}
      {(activeGroup || activeUser) ? (
        <div className="flex flex-col w-full sm:w-2/3 bg-white relative min-w-0">
        {/* Header */}
        <div className="p-3 sm:p-4 border-b border-gray-200 flex justify-between items-center shadow-sm z-10 gap-2">
          <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
            {/* Back button - mobile only */}
            <button
              onClick={() => { setActiveGroup(null); setActiveUser(null); setShowMembersPanel(false); }}
              className="sm:hidden p-2 -ml-2 rounded-lg hover:bg-gray-100 text-gray-600 shrink-0"
              aria-label="Back to messages"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
              {activeGroup ? (
                <>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0 ${activeGroup.isPrivate ? 'bg-indigo-500' : 'bg-brand-500'}`}>
               {activeGroup.isPrivate ? <Users size={16} /> : <Hash size={16} />}
            </div>
            <div className="min-w-0 flex-1">
               <span className="font-bold text-gray-800 text-sm sm:text-base block leading-none truncate">{activeGroup.name}</span>
                    <span className="text-xs text-gray-500">
                      {(() => {
                        const gid = (activeGroup as any).groupId ?? getGroupId(activeGroup);
                        const actualCount = (currentGroupMembers.length > 0 ? currentGroupMembers.length : null)
                          ?? (gid != null && groupMembers[gid] ? groupMembers[gid].length : null)
                          ?? (activeGroup.members?.length ?? null);
                        const memberCount = actualCount ?? activeGroup.totalParticipant ?? 0;
                        return `${memberCount} participants`;
                      })()}
                    </span>
                  </div>
                </>
              ) : activeUser ? (
                <>
                  <img
                    src={activeUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(activeUser.name)}&background=random`}
                    alt={activeUser.name}
                    className="w-10 h-10 rounded-full object-cover border-2 border-brand-500"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      if (!target.src.includes('ui-avatars.com')) {
                        target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(activeUser.name)}&background=random`;
                      }
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-gray-800 text-sm sm:text-base block leading-none truncate">{activeUser.name}</span>
                    <span className="text-xs text-gray-500 truncate block">{activeUser.email || activeUser.designation || activeUser.role}</span>
                  </div>
                </>
              ) : null}
            </div>
            <div className="flex items-center gap-1 sm:gap-2 shrink-0 relative">
              {/* Audio call - POST /messaging/initiateCall/ { user_id, call_type: "audio" } */}
              <button
                onClick={async () => {
                  if (!activeGroup && !activeUser) return;
                  if (activeUser) {
                    const granted = await requestCallMediaPermissions('audio');
                    if (!granted) {
                      alert('Microphone access is required for audio calls. Please allow microphone permission and try again.');
                      return;
                    }
                    setIsInitiatingCall(true);
                    try {
                      const res = await apiInitiateCall(activeUser.id || activeUser.name, 'audio');
                      const callId = res?.call_id ?? res?.id ?? res?.callId;
                      startOutgoingCall({ name: activeUser.name, id: activeUser.id || activeUser.name, avatar: activeUser.avatar }, 'audio', callId ?? (activeUser.id || activeUser.name));
                    } catch (e: any) {
                      console.error('Initiate audio call failed:', e);
                      alert(e?.message || 'Failed to start audio call. Please try again.');
                    } finally {
                      setIsInitiatingCall(false);
                    }
                  } else if (activeGroup) {
                    setShowCallParticipantPicker('audio');
                  }
                }}
                disabled={isInitiatingCall}
                className="p-2 sm:p-2.5 rounded-lg text-gray-600 hover:text-brand-600 hover:bg-brand-50 transition-colors disabled:opacity-50"
                title="Audio call"
                aria-label="Audio call"
              >
                <Phone size={18} />
              </button>
              {/* Video call - POST /messaging/initiateCall/ { user_id, call_type: "video" } */}
              <button
                onClick={async () => {
                  if (!activeGroup && !activeUser) return;
                  if (activeUser) {
                    const granted = await requestCallMediaPermissions('video');
                    if (!granted) {
                      alert('Camera and microphone access are required for video calls. Please allow permissions and try again.');
                      return;
                    }
                    setIsInitiatingCall(true);
                    try {
                      const res = await apiInitiateCall(activeUser.id || activeUser.name, 'video');
                      const callId = res?.call_id ?? res?.id ?? res?.callId;
                      startOutgoingCall({ name: activeUser.name, id: activeUser.id || activeUser.name, avatar: activeUser.avatar }, 'video', callId ?? (activeUser.id || activeUser.name));
                    } catch (e: any) {
                      console.error('Initiate video call failed:', e);
                      alert(e?.message || 'Failed to start video call. Please try again.');
                    } finally {
                      setIsInitiatingCall(false);
                    }
                  } else if (activeGroup) {
                    setShowCallParticipantPicker('video');
                  }
                }}
                disabled={isInitiatingCall}
                className="p-2 sm:p-2.5 rounded-lg text-gray-600 hover:text-brand-600 hover:bg-brand-50 transition-colors disabled:opacity-50"
                title="Video call"
                aria-label="Video call"
              >
                <Video size={18} />
              </button>
              {/* Group call - when in a group, opens multi-select modal */}
              {activeGroup && (
                <div ref={groupCallPickerRef} className="relative">
                  <button
                    onClick={() => setShowGroupCallPicker(showGroupCallPicker ? null : 'audio')}
                    disabled={isInitiatingCall}
                    className="p-2 sm:p-2.5 rounded-lg text-gray-600 hover:text-brand-600 hover:bg-brand-50 transition-colors disabled:opacity-50"
                    title="Group call"
                  >
                    <Users size={18} />
                  </button>
                  {showGroupCallPicker && (
                    <div className="absolute right-0 top-full mt-1 py-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[160px]">
                      <p className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase">Group call</p>
                      <button
                        onClick={() => setShowGroupCallPicker('audio')}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 ${showGroupCallPicker === 'audio' ? 'bg-brand-50' : ''}`}
                      >
                        Group audio
                      </button>
                      <button
                        onClick={() => setShowGroupCallPicker('video')}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 ${showGroupCallPicker === 'video' ? 'bg-brand-50' : ''}`}
                      >
                        Group video
                      </button>
                      <hr className="my-1" />
                      <p className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase">Select participants</p>
                      {(currentGroupMembers.length > 0 ? currentGroupMembers : (groupMembers[(activeGroup as any).groupId ?? getGroupId(activeGroup)] || []).map((n: string) => ({ participant_name: n }))).map((m: { participant_name: string }) => {
                        const name = m.participant_name || (typeof m === 'string' ? m : '');
                        if (!name || name === currentUser.name) return null;
                        const u = users.find((x: User) => x.name === name || x.id === name);
                        const userId = u?.id || u?.name || name;
                        const isSelected = selectedGroupCallUserIds.has(userId);
                        return (
                          <button
                            key={userId}
                            onClick={() => {
                              setSelectedGroupCallUserIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(userId)) next.delete(userId);
                                else next.add(userId);
                                return next;
                              });
                            }}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                          >
                            <span className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-brand-600 border-brand-600' : 'border-gray-400'}`}>
                              {isSelected && <Check size={12} className="text-white" />}
                            </span>
                            {name}
                          </button>
                        );
                      })}
                      <hr className="my-1" />
                      <button
                        onClick={async () => {
                          if (selectedGroupCallUserIds.size === 0) {
                            alert('Please select at least one participant.');
                            return;
                          }
                          const granted = await requestCallMediaPermissions(showGroupCallPicker);
                          if (!granted) {
                            alert(showGroupCallPicker === 'audio' ? 'Microphone access is required.' : 'Camera and microphone access are required.');
                            return;
                          }
                          setIsInitiatingCall(true);
                          setShowGroupCallPicker(null);
                          try {
                            const userIds = Array.from(selectedGroupCallUserIds);
                            const res = await apiInitiateGroupCall(userIds, showGroupCallPicker);
                            const callId = res?.call_id ?? res?.id;
                            const participantUsernames = res?.participant_usernames ?? userIds;
                            const creator = res?.creator ?? currentUser.name ?? currentUser.id ?? '';
                            if (callId != null) {
                              startOutgoingGroupCall(showGroupCallPicker, Number(callId), creator, participantUsernames);
                              wsSend({ type: 'join_group_call', call_id: Number(callId) });
                            }
                          } catch (e: any) {
                            console.error('Initiate group call failed:', e);
                            alert(e?.message || 'Failed to start group call.');
                          } finally {
                            setIsInitiatingCall(false);
                            setSelectedGroupCallUserIds(new Set());
                          }
                        }}
                        disabled={selectedGroupCallUserIds.size === 0 || isInitiatingCall}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 font-medium text-brand-600 disabled:opacity-50"
                      >
                        Start group call
                      </button>
                      <button onClick={() => { setShowGroupCallPicker(null); setSelectedGroupCallUserIds(new Set()); }} className="w-full px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-100">
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              )}
              {/* Participant picker for 1:1 calls */}
              {showCallParticipantPicker && activeGroup && (
                <div ref={callPickerRef} className="absolute right-0 top-full mt-1 py-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[160px]">
                  <p className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase">Call participant</p>
                  {(currentGroupMembers.length > 0 ? currentGroupMembers : (groupMembers[(activeGroup as any).groupId ?? getGroupId(activeGroup)] || []).map((n: string) => ({ participant_name: n }))).map((m: { participant_name: string }) => {
                    const name = m.participant_name || (typeof m === 'string' ? m : '');
                    if (!name || name === currentUser.name) return null;
                    const u = users.find((x: User) => x.name === name || x.id === name);
                    const userId = u?.id || u?.name || name;
                    return (
                      <button
                        key={userId}
                        onClick={async () => {
                          const granted = await requestCallMediaPermissions(showCallParticipantPicker);
                          if (!granted) {
                            alert(showCallParticipantPicker === 'audio'
                              ? 'Microphone access is required for audio calls. Please allow microphone permission and try again.'
                              : 'Camera and microphone access are required for video calls. Please allow permissions and try again.');
                            return;
                          }
                          setIsInitiatingCall(true);
                          setShowCallParticipantPicker(null);
                          try {
                            const res = await apiInitiateCall(userId, showCallParticipantPicker);
                            const callId = res?.call_id ?? res?.id ?? res?.callId;
                            const targetUser = users.find((x: User) => x.name === name || x.id === userId);
                            startOutgoingCall({ name, id: userId, avatar: targetUser?.avatar }, showCallParticipantPicker, callId ?? userId);
                          } catch (e: any) {
                            console.error('Initiate call failed:', e);
                            alert(e?.message || 'Failed to start call. Please try again.');
                          } finally {
                            setIsInitiatingCall(false);
                          }
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100"
                      >
                        {name}
                      </button>
                    );
                  })}
                  <button onClick={() => setShowCallParticipantPicker(null)} className="w-full px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-100">
                    Cancel
                  </button>
                </div>
              )}
              {activeGroup && (
                <button
                  onClick={() => setShowMembersPanel(!showMembersPanel)}
                  className={`flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-colors ${
                    showMembersPanel 
                      ? 'bg-brand-600 text-white' 
                      : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                  }`}
                  title="Show group members"
                >
                  <Users size={18} />
                  <span className="text-xs sm:text-sm font-medium hidden sm:inline">
                    {(() => {
                      const gid = (activeGroup as any).groupId ?? getGroupId(activeGroup);
                      const actualCount = (currentGroupMembers.length > 0 ? currentGroupMembers.length : null)
                        ?? (gid != null && groupMembers[gid] ? groupMembers[gid].length : null)
                        ?? (activeGroup.members?.length ?? null);
                      return actualCount ?? activeGroup.totalParticipant ?? 0;
                    })()}
                  </span>
                </button>
              )}
            </div>
        </div>

        {/* Messages */}
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-6 bg-slate-50">
          {isLoadingMessages ? (
            <div className="text-center text-gray-400 mt-10">
              <p>Loading messages...</p>
            </div>
          ) : apiMessages.length === 0 ? (
            <div className="text-center text-gray-400 mt-10">
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            // Sort messages by date and time (oldest first, newest last) to show latest at bottom
            [...apiMessages].sort((a, b) => {
              // Parse date in DD/MM/YY format and time in HH:MM or HH:MM:SS format
              const parseDateTime = (date: string, time: string) => {
                if (!date) return 0;
                // Date format: "14/01/26" (DD/MM/YY)
                const dateParts = date.split('/');
                if (dateParts.length === 3) {
                  const day = parseInt(dateParts[0], 10);
                  const month = parseInt(dateParts[1], 10) - 1;
                  const year = 2000 + parseInt(dateParts[2], 10);
                  // Time format: "11:55" (HH:MM) or "11:19:37" (HH:MM:SS)
                  const timeParts = (time || '00:00:00').split(':');
                  const hours = parseInt(timeParts[0] || '0', 10);
                  const minutes = parseInt(timeParts[1] || '0', 10);
                  const seconds = parseInt(timeParts[2] || '0', 10);
                  return new Date(year, month, day, hours, minutes, seconds).getTime();
                }
                return 0;
              };
              
              const dateTimeA = parseDateTime(a.date || '', a.time || '00:00:00');
              const dateTimeB = parseDateTime(b.date || '', b.time || '00:00:00');
              
              // Return negative if A is earlier (should come first), positive if B is earlier
              return dateTimeA - dateTimeB;
            }).map((msg, index) => {
              const isMe = msg.sender === currentUser.name || msg.sender === currentUser.id;
              const sender = users.find(u => u.name === msg.sender || u.id === msg.sender);

              // Unique key for this message to track deletion
              const msgKey = `${index}::${msg.sender}::${msg.date}::${msg.time}`;

              // Skip messages the user has locally deleted
              if (deletedMsgKeys.has(msgKey)) return null;

              // ── Parse attachment tags ─────────────────────────────────────
              // New API format: msg.attachment = { id, type, file_name, url }
              // Legacy tag format: [FILE:contentType|fileName|url]
              const fileMatch = !msg.attachment && msg.message?.match(/^\[FILE:([^|]+)\|([^|]+)\|(.+)\]$/);
              // [LINK:title|url]
              const linkMatch = !msg.attachment && !fileMatch && msg.message?.match(/^\[LINK:([^|]*)\|(.+)\]$/);

              // Unified attachment info (new API shape takes priority over legacy tags)
              const attUrl      = msg.attachment?.url      ?? (fileMatch ? fileMatch[3] : null);
              const attFileName = msg.attachment?.file_name ?? (fileMatch ? fileMatch[2] : null);
              // Attachment id — used to route download through the backend API (works in production).
              const attId       = msg.attachment?.id ?? msg.attachment_id ?? undefined;
              // Determine MIME type: new API doesn't give MIME so infer from file name
              const inferMime = (name: string): string => {
                const ext = name.split('.').pop()?.toLowerCase() ?? '';
                if (['jpg','jpeg','png','gif','webp','bmp','svg'].includes(ext)) return 'image/' + (ext === 'jpg' ? 'jpeg' : ext);
                if (['mp4','webm','ogg','mov','mkv'].includes(ext))              return 'video/' + ext;
                if (['mp3','wav','ogg','aac','flac'].includes(ext))              return 'audio/' + ext;
                if (ext === 'pdf')                                               return 'application/pdf';
                if (['zip','rar','7z','tar','gz'].includes(ext))                return 'application/zip';
                return 'application/octet-stream';
              };
              const attMime = msg.attachment
                ? inferMime(msg.attachment.file_name)
                : (fileMatch ? fileMatch[1] : null);

              const hasAttachment = !!(attUrl && attFileName);
              const isImageFile = hasAttachment && (attMime?.startsWith('image/') ?? false);
              const isVideoFile = hasAttachment && (attMime?.startsWith('video/') ?? false);
              const isAudioFile = hasAttachment && (attMime?.startsWith('audio/') ?? false);

              const getFileIcon = (ct: string) => {
                if (ct.startsWith('image/'))                          return <FileImage size={16} />;
                if (ct.startsWith('video/'))                          return <Film size={16} />;
                if (ct.startsWith('audio/'))                          return <Music size={16} />;
                if (ct.includes('pdf'))                               return <FileText size={16} />;
                if (ct.includes('zip') || ct.includes('rar') || ct.includes('7z')) return <Archive size={16} />;
                return <FileIcon size={16} />;
              };

              const bubbleBase = `max-w-[85%] sm:max-w-[70%] rounded-2xl shadow-sm overflow-hidden ${isMe ? 'bg-brand-600 text-white rounded-br-none' : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none'}`;
              const metaClass  = `text-[10px] pb-2 pr-3 text-right ${isMe ? 'text-brand-200' : 'text-gray-400'}`;
              const isConfirming = confirmDeleteKey === msgKey;

              return (
                <div
                  key={index}
                  className={`flex items-end gap-1 group ${isMe ? 'justify-end' : 'justify-start'}`}
                >
                  {!isMe && (
                    <img
                      src={sender?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(msg.sender)}&background=random`}
                      className="w-8 h-8 rounded-full mr-1 self-end mb-1 flex-shrink-0"
                      alt=""
                      onError={(e) => { const t = e.target as HTMLImageElement; if (!t.src.includes('ui-avatars.com')) t.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(msg.sender)}&background=random`; }}
                    />
                  )}

                  {/* ── Forward button — left of bubble for others' messages ── */}
                  {!isMe && (
                    <button
                      type="button"
                      onClick={() => openForwardModal(msg.message)}
                      className="flex-shrink-0 mb-1 w-7 h-7 flex items-center justify-center rounded-full bg-white border border-gray-200 hover:bg-brand-50 hover:border-brand-300 text-gray-400 hover:text-brand-600 shadow-sm transition-colors opacity-0 group-hover:opacity-100"
                      title="Forward message"
                    >
                      <Forward size={13} />
                    </button>
                  )}

                  {/* ── Delete button — left of bubble for own messages ── */}
                  {isMe && (
                    <div className={`flex-shrink-0 mb-1 transition-opacity duration-150 ${isConfirming || deletingMsgKey === msgKey ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                      {deletingMsgKey === msgKey ? (
                        /* ── Deleting spinner ── */
                        <div className="flex items-center gap-1 bg-white border border-red-200 rounded-xl shadow-md px-2 py-1">
                          <div className="w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                          <span className="text-[10px] text-red-500">Deleting…</span>
                        </div>
                      ) : isConfirming ? (
                        /* ── Confirm popup ── */
                        <div className="flex items-center gap-1 bg-white border border-red-200 rounded-xl shadow-md px-2 py-1">
                          <span className="text-[10px] text-red-600 font-medium whitespace-nowrap">Delete?</span>
                          <button
                            type="button"
                            onClick={async () => {
                              setConfirmDeleteKey(null);
                              // If the message has an attachment_id, delete it via the API
                              if (msg.attachment_id != null) {
                                setDeletingMsgKey(msgKey);
                                try {
                                  await apiDeleteAttachment(msg.attachment_id);
                                  // On success: hide the message row
                                  setDeletedMsgKeys((prev) => new Set(prev).add(msgKey));
                                } catch (err: any) {
                                  const errMsg: string = err?.message ?? 'Failed to delete';
                                  // 400 "already sent" – hide locally anyway
                                  if (errMsg.includes('already sent')) {
                                    setDeletedMsgKeys((prev) => new Set(prev).add(msgKey));
                                  } else {
                                    // Show a brief inline error by re-setting confirmDeleteKey
                                    // so the user can see something went wrong
                                    alert(errMsg);
                                  }
                                } finally {
                                  setDeletingMsgKey(null);
                                }
                              } else {
                                // No attachment_id – local removal only
                                setDeletedMsgKeys((prev) => new Set(prev).add(msgKey));
                              }
                            }}
                            className="text-[10px] font-semibold text-white bg-red-500 hover:bg-red-600 px-2 py-0.5 rounded-lg transition-colors"
                          >
                            Yes
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteKey(null)}
                            className="text-[10px] font-semibold text-gray-500 hover:text-gray-700 px-1.5 py-0.5 rounded-lg hover:bg-gray-100 transition-colors"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        /* ── Trash icon (hover-reveal) ── */
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteKey(msgKey)}
                          className="w-7 h-7 flex items-center justify-center rounded-full bg-white border border-gray-200 hover:bg-red-50 hover:border-red-300 text-gray-400 hover:text-red-500 shadow-sm transition-colors"
                          title="Delete message"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  )}

                  {/* ── FILE attachment bubble ── */}
                  {hasAttachment ? (
                    <div className={bubbleBase}>
                      {!isMe && <p className="text-xs font-bold text-brand-600 px-3 pt-2 mb-1">{msg.sender}</p>}
                      <div className="px-2 pt-1 pb-0">
                        {(isImageFile || (!isVideoFile && !isAudioFile)) && (
                          <div className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium ${isMe ? 'bg-brand-500/30 text-white' : 'bg-gray-100 text-gray-800'}`}>
                            <span className={isMe ? 'text-brand-200' : 'text-brand-600'}>{getFileIcon(attMime ?? '')}</span>
                            <div className="flex-1 min-w-0">
                              <span className="truncate block">{attFileName}</span>
                              <span className={`text-xs ${isMe ? 'text-brand-200/90' : 'text-gray-500'}`}>Click to download</span>
                            </div>
                            <a
                              href={attUrl!}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isMe ? 'hover:bg-white/20 text-white' : 'hover:bg-gray-200 text-gray-600'}`}
                              title="Open in new tab"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink size={14} />
                            </a>
                            <button
                              type="button"
                              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isMe ? 'hover:bg-white/20 text-white' : 'hover:bg-gray-200 text-gray-600'}`}
                              title="Download"
                              onClick={(e) => { e.stopPropagation(); triggerDownload(attUrl!, attFileName!, attId); }}
                            >
                              <Download size={14} />
                            </button>
                          </div>
                        )}
                        {isVideoFile && (
                          <video src={attUrl!} controls className="max-w-full max-h-52 rounded-xl" />
                        )}
                        {isAudioFile && (
                          <>
                            <audio src={attUrl!} controls className="w-full mt-1 rounded-lg" />
                            <p className={`text-[10px] truncate max-w-[180px] mt-0.5 px-1 ${isMe ? 'text-brand-200' : 'text-gray-400'}`}>{attFileName}</p>
                          </>
                        )}
                        {isVideoFile && (
                          <p className={`text-[10px] truncate max-w-[180px] mt-0.5 px-1 ${isMe ? 'text-brand-200' : 'text-gray-400'}`}>{attFileName}</p>
                        )}
                        {/* Caption text (message text alongside the attachment) */}
                        {msg.message && msg.message !== attFileName && (
                          <div className="px-1 mt-1">
                            <MessageContent content={msg.message} isOwn={isMe} />
                          </div>
                        )}
                      </div>
                      <p className={metaClass}>{msg.date} {msg.time}</p>
                    </div>

                  /* ── LINK attachment bubble ── */
                  ) : linkMatch ? (
                    <div className={bubbleBase}>
                      {!isMe && <p className="text-xs font-bold text-brand-600 px-3 pt-2 mb-1">{msg.sender}</p>}
                      <div className="px-2 pt-1 pb-0">
                        <a
                          href={linkMatch[2]}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${isMe ? 'bg-brand-500/30 hover:bg-brand-500/50 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-800'}`}
                        >
                          <ExternalLink size={16} className={isMe ? 'text-brand-200 flex-shrink-0' : 'text-brand-600 flex-shrink-0'} />
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-xs">{linkMatch[1] || linkMatch[2]}</p>
                            <p className={`truncate text-[10px] ${isMe ? 'text-brand-200' : 'text-gray-400'}`}>{linkMatch[2]}</p>
                          </div>
                        </a>
                      </div>
                      <p className={metaClass}>{msg.date} {msg.time}</p>
                    </div>

                  /* ── Plain text bubble ── */
                  ) : (
                    <div className={`${bubbleBase} p-3 sm:p-4`}>
                      {!isMe && <p className="text-xs font-bold text-brand-600 mb-1">{msg.sender}</p>}
                      <MessageContent content={msg.message} isOwn={isMe} />
                      <p className={`text-[10px] mt-2 text-right ${isMe ? 'text-brand-200' : 'text-gray-400'}`}>{msg.date} {msg.time}</p>
                    </div>
                  )}

                  {/* ── Forward button — right of bubble for own messages ── */}
                  {isMe && (
                    <button
                      type="button"
                      onClick={() => openForwardModal(msg.message)}
                      className="flex-shrink-0 mb-1 w-7 h-7 flex items-center justify-center rounded-full bg-white border border-gray-200 hover:bg-brand-50 hover:border-brand-300 text-gray-400 hover:text-brand-600 shadow-sm transition-colors opacity-0 group-hover:opacity-100"
                      title="Forward message"
                    >
                      <Forward size={13} />
                    </button>
                  )}
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Typing indicator - bottom of chat */}
        {typingUsers.length > 0 && (
          <div className="px-4 py-2 bg-brand-50/50 border-t border-gray-100 text-sm text-gray-600 italic">
            {typingUsers.length === 1
              ? `${typingUsers[0]} is typing...`
              : typingUsers.length === 2
                ? `${typingUsers[0]} and ${typingUsers[1]} are typing...`
                : `${typingUsers.slice(0, -1).join(', ')} and ${typingUsers[typingUsers.length - 1]} are typing...`}
          </div>
        )}

        {/* Input */}
        <div
          className={`p-3 sm:p-4 bg-white border-t border-gray-200 relative transition-colors ${isDraggingOver ? 'ring-2 ring-brand-500 ring-inset bg-brand-50/50' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >

          {/* ── Attachment preview tray ── */}
          {stagedAttachment && (
            <div className="mb-2 rounded-xl border border-brand-200 bg-brand-50 p-2 flex items-start gap-3">
              {/* File preview */}
              {stagedAttachment.kind === 'file' && (
                <>
                  {stagedAttachment.preview ? (
                    <img src={stagedAttachment.preview} alt="preview" className="w-14 h-14 rounded-lg object-cover flex-shrink-0 border border-brand-200" />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-brand-100 flex items-center justify-center flex-shrink-0">
                      <FileIcon size={24} className="text-brand-500" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-brand-800 truncate">{stagedAttachment.file.name}</p>
                    <p className="text-[10px] text-brand-500 mt-0.5">
                      {stagedAttachment.file.type || 'file'} · {(stagedAttachment.file.size / 1024).toFixed(1)} KB
                    </p>
                    {stagedAttachment.error && (
                      <p className="text-[10px] text-red-600 flex items-center gap-1 mt-0.5">
                        <AlertCircle size={10} /> {stagedAttachment.error}
                      </p>
                    )}
                    {!stagedAttachment.uploaded && !stagedAttachment.error && (
                      <p className="text-[10px] text-brand-400 mt-0.5 animate-pulse">Uploading…</p>
                    )}
                    {stagedAttachment.uploaded && !stagedAttachment.error && (
                      <p className="text-[10px] text-green-600 mt-0.5">Ready to send</p>
                    )}
                  </div>
                </>
              )}
              {/* Link preview */}
              {stagedAttachment.kind === 'link' && (
                <>
                  <div className="w-14 h-14 rounded-lg bg-brand-100 flex items-center justify-center flex-shrink-0">
                    <ExternalLink size={24} className="text-brand-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-brand-800 truncate">{stagedAttachment.title || stagedAttachment.url}</p>
                    <p className="text-[10px] text-brand-400 truncate">{stagedAttachment.url}</p>
                    {stagedAttachment.error && (
                      <p className="text-[10px] text-red-600 flex items-center gap-1 mt-0.5">
                        <AlertCircle size={10} /> {stagedAttachment.error}
                      </p>
                    )}
                    {!stagedAttachment.saved && !stagedAttachment.error && (
                      <p className="text-[10px] text-brand-400 mt-0.5 animate-pulse">Saving link…</p>
                    )}
                    {stagedAttachment.saved && !stagedAttachment.error && (
                      <p className="text-[10px] text-green-600 mt-0.5">Ready to send</p>
                    )}
                  </div>
                </>
              )}
              {/* Remove / delete button – always visible */}
              <button
                type="button"
                onClick={handleDeleteStagedAttachment}
                className="flex-shrink-0 ml-1 w-7 h-7 flex items-center justify-center rounded-full bg-red-100 hover:bg-red-200 text-red-500 hover:text-red-700 transition-colors shadow-sm"
                title="Remove attachment"
              >
                <X size={15} strokeWidth={2.5} />
              </button>
            </div>
          )}

          {/* ── Link input panel ── */}
          {showLinkInput && (
            <div className="mb-2 rounded-xl border border-gray-200 bg-gray-50 p-3 flex flex-col gap-2">
              <p className="text-xs font-semibold text-gray-700">Attach a link</p>
              <input
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddLink(); } }}
                placeholder="https://example.com"
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-400"
                autoFocus
              />
              <input
                type="text"
                value={linkTitle}
                onChange={(e) => setLinkTitle(e.target.value)}
                placeholder="Display title (optional)"
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => { setShowLinkInput(false); setLinkUrl(''); setLinkTitle(''); }}
                  className="text-xs px-3 py-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 transition-colors"
                >Cancel</button>
                <button
                  type="button"
                  onClick={handleAddLink}
                  disabled={!linkUrl.trim()}
                  className="text-xs px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white transition-colors disabled:opacity-50"
                >Attach</button>
              </div>
            </div>
          )}

          {/* ── Main input row ── */}
          <div className="flex items-center space-x-2 bg-gray-100 rounded-xl px-3 sm:px-4 py-2 border border-gray-200">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z"
              className="hidden"
              onChange={handleFileChange}
            />

            {/* Emoji Picker Button */}
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="text-gray-500 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-200 transition-colors flex-shrink-0"
              title="Add emoji"
            >
              <Smile size={20} />
            </button>

            {/* Attach file button */}
            <button
              type="button"
              onClick={() => { setShowLinkInput(false); fileInputRef.current?.click(); }}
              disabled={!!stagedAttachment || isProcessingAttachment}
              className="text-gray-500 hover:text-brand-600 p-1.5 rounded-lg hover:bg-gray-200 transition-colors flex-shrink-0 disabled:opacity-40"
              title="Attach file"
            >
              <Paperclip size={20} />
            </button>

            {/* Attach link button */}
            <button
              type="button"
              onClick={() => { if (!stagedAttachment) setShowLinkInput((v) => !v); }}
              disabled={!!stagedAttachment || isProcessingAttachment}
              className={`p-1.5 rounded-lg transition-colors flex-shrink-0 disabled:opacity-40 ${showLinkInput ? 'text-brand-600 bg-brand-100' : 'text-gray-500 hover:text-brand-600 hover:bg-gray-200'}`}
              title="Attach link"
            >
              <Link2 size={20} />
            </button>

            {/* Emoji Picker */}
            {showEmojiPicker && (
              <div className="emoji-picker-container absolute bottom-full left-2 right-2 sm:left-4 sm:right-auto mb-2 z-50">
                <EmojiPicker
                  onEmojiClick={(emojiData) => {
                    setInput((prev) => prev + emojiData.emoji);
                    setShowEmojiPicker(false);
                  }}
                  theme={Theme.LIGHT}
                  width={320}
                  height={380}
                  searchPlaceholder="Search emoji"
                />
              </div>
            )}

            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPaste={handlePaste}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={stagedAttachment ? 'Add a caption (optional)…' : 'Type a message…'}
              className="flex-1 bg-transparent focus:outline-none text-sm text-gray-700 min-w-0"
            />
            <button 
              onClick={handleSend} 
              disabled={(!input.trim() && !stagedAttachment) || isSendingMessage || isProcessingAttachment}
              className="bg-brand-600 text-white p-2 rounded-lg hover:bg-brand-700 shadow-sm transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Send message"
            >
              {isSendingMessage || isProcessingAttachment ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Send size={18} />
              )}
            </button>
          </div>
        </div>

          {/* Group Members Panel - Only show for groups */}
          {showMembersPanel && activeGroup && (
            <div className="absolute right-0 top-0 bottom-0 w-full sm:w-80 bg-white border-l border-gray-200 shadow-xl z-20 flex flex-col">
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-gray-800 text-lg">People ({currentGroupMembers.length})</h3>
                  <button
                    onClick={() => setShowMembersPanel(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Members List */}
              <div className="flex-1 overflow-y-auto p-4">
                {isLoadingMembers ? (
                  <div className="text-center text-gray-400 py-8">Loading members...</div>
                ) : currentGroupMembers.length === 0 ? (
                  <div className="text-center text-gray-400 py-8">No members found</div>
                ) : (
                  <div className="space-y-2">
                    {currentGroupMembers.map((member, index) => {
                      const participantName = member.participant_name || '';
                      // Match participant_name (e.g. "vaishnavi") to employee - API may return first name only or full name
                      const nameMatches = (u: { name?: string; id?: string }) => {
                        const p = participantName.toLowerCase().trim();
                        const n = (u.name || '').toLowerCase().trim();
                        if (!p) return false;
                        return (
                          n === p ||
                          n.startsWith(p) ||
                          (n.split(/\s+/)[0] === p) ||
                          u.id === participantName
                        );
                      };
                      const memberUser = users.find(nameMatches) ||
                        availableEmployees.find(nameMatches) ||
                        users.find(nameMatches);
                      
                      const isCurrentUser = participantName === currentUser.name || 
                                           participantName === currentUser.id ||
                                           currentUser.name?.toLowerCase() === participantName.toLowerCase();
                      
                      const displayName = participantName || 'Unknown User';
                      const displayEmail = memberUser?.email || '';
                      const avatar = memberUser?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`;
                      
                      // CRITICAL: API requires Employee ID only - never pass name/fullname
                      let userIdForDelete: string | null = memberUser?.id ?? (member as any).participant_id ?? null;
                      if (userIdForDelete && userIdForDelete.toLowerCase() === participantName.toLowerCase()) {
                        userIdForDelete = null; // Avoid passing name when id incorrectly equals name
                      }
                      const isMD = memberUser?.role === UserRole.MD;
                      const canDelete = canCreateGroup && !isCurrentUser && !isMD && !!userIdForDelete;

                      return (
                        <div
                          key={index}
                          className={`flex items-center space-x-3 p-3 rounded-lg ${
                            isCurrentUser ? 'bg-brand-50 border border-brand-200' : 'hover:bg-gray-50'
                          }`}
                        >
                          <img
                            src={avatar}
                            alt={displayName}
                            className="w-10 h-10 rounded-full flex-shrink-0"
                            onError={(e) => { const t = e.target as HTMLImageElement; if (!t.src.includes('ui-avatars.com')) t.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`; }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-700 truncate">
                              {displayName}
                              {isCurrentUser && (
                                <span className="ml-2 text-xs text-brand-600 font-normal">(You)</span>
                              )}
                            </p>
                            {displayEmail && (
                              <p className="text-xs text-gray-500 truncate">{displayEmail}</p>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 flex-shrink-0">
                            {isCurrentUser && (
                              <Check size={16} className="text-brand-600" />
                            )}
                            {/* Delete icon on the right - only for group creators */}
                            {canDelete && (
                              <button
                                onClick={() => handleDeleteUserFromGroup(userIdForDelete, displayName)}
                                className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded transition-colors"
                                title={`Remove ${displayName} from group`}
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="p-4 border-t border-gray-200 bg-gray-50 space-y-2">
                {canCreateGroup && (
                  <button
                    onClick={() => {
                      if (activeGroup?.groupId) {
                        setShowAddUserModal(true);
                      } else {
                        alert('Please select a group first');
                      }
                    }}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
                  >
                    <UserPlus size={18} />
                    <span>Add user</span>
                  </button>
                )}
                {canCreateGroup && (
                  <button
                    onClick={handleDeleteGroup}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                  >
                    <Trash2 size={18} />
                    <span>Delete Group</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="hidden sm:flex w-2/3 items-center justify-center bg-gray-50">
          <div className="text-center text-gray-400 p-4">
            <Users size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-base sm:text-lg">Select a group or user to start chatting</p>
          </div>
        </div>
      )}

      {/* Create Group Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-2 sm:p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl sm:rounded-2xl w-full max-w-2xl max-h-[95vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-4 sm:p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="text-lg sm:text-2xl font-bold text-gray-800">Create New Group</h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setCreateGroupSearchQuery('');
                }}
                className="text-gray-400 hover:text-gray-600 bg-white rounded-full p-2 shadow-sm"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4 flex-1 overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Group Name *</label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="Enter group name"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={newGroupDescription}
                  onChange={(e) => setNewGroupDescription(e.target.value)}
                  placeholder="Enter group description (optional)"
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Participants *</label>
                <div className="relative mb-2">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search employees..."
                    value={createGroupSearchQuery}
                    onChange={(e) => setCreateGroupSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-200 bg-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none"
                  />
                  {createGroupSearchQuery && (
                    <button
                      onClick={() => setCreateGroupSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded"
                      aria-label="Clear search"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                <div className="border border-gray-200 rounded-lg p-4 max-h-64 overflow-y-auto bg-gray-50">
                  {(() => {
                    const createSearchLower = createGroupSearchQuery.trim().toLowerCase();
                    const filtered = availableEmployees.filter(
                      (u) =>
                        u.id !== currentUser.id &&
                        u.id !== '2000' &&
                        (!createSearchLower ||
                          (u.name || '').toLowerCase().includes(createSearchLower) ||
                          (u.email || '').toLowerCase().includes(createSearchLower) ||
                          (u.id || '').toLowerCase().includes(createSearchLower))
                    );
                    return filtered.length === 0 ? (
                      <p className="text-sm text-gray-400">
                        {createGroupSearchQuery ? 'No employees match your search' : 'No other employees available'}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {filtered.map((user) => (
                        <label
                          key={user.id}
                          className="flex items-center space-x-3 p-2 hover:bg-white rounded-lg cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={!!selectedParticipants[user.name || user.id]}
                            onChange={() => toggleParticipant(user.id, user.name || user.id)}
                            className="rounded text-brand-600 focus:ring-brand-500"
                          />
                          <div className="flex items-center space-x-2 flex-1">
                            <img src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || '')}&background=random`} alt={user.name} className="w-8 h-8 rounded-full" onError={(e) => { const t = e.target as HTMLImageElement; if (!t.src.includes('ui-avatars.com')) t.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || '')}&background=random`; }} />
                            <div>
                              <p className="text-sm font-medium text-gray-700">{user.name}</p>
                              <p className="text-xs text-gray-500">{user.email}</p>
                            </div>
                          </div>
                          {selectedParticipants[user.name || user.id] && (
                            <Check size={16} className="text-brand-600" />
                          )}
                        </label>
                        ))}
                      </div>
                    );
                  })()}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Selected: {Object.keys(selectedParticipants).length} participant(s)
                </p>
              </div>
            </div>
            
            <div className="p-4 sm:p-6 border-t border-gray-100 flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 bg-gray-50">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setCreateGroupSearchQuery('');
                }}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateGroup}
                disabled={isCreatingGroup || !newGroupName.trim() || Object.keys(selectedParticipants).length === 0}
                className="px-4 py-2 text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreatingGroup ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </div>
      </div>
      )}

      {/* Add User to Group Modal */}
      {showAddUserModal && activeGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 backdrop-blur-sm p-2 sm:p-4">
          <div className="bg-white rounded-xl sm:rounded-2xl p-4 sm:p-6 w-full max-w-md max-h-[95vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg sm:text-xl font-bold text-gray-800">Add User to Group</h3>
              <button
                onClick={() => {
                  setShowAddUserModal(false);
                  setSelectedUserToAdd('');
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                Group: <strong>{activeGroup.name}</strong>
              </p>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Select User to Add
              </label>
              <select
                  value={selectedUserToAdd}
                  onChange={(e) => setSelectedUserToAdd(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none bg-white"
                >
                  <option value="">-- Select a user --</option>
                  {users
                    .filter(user => {
                      // Filter out users who are already in the group
                      const isAlreadyMember = currentGroupMembers.some(
                        member => member.participant_name === user.name || member.participant_name === user.id
                      );
                      return !isAlreadyMember && user.id !== currentUser.id;
                    })
                    .map(user => (
                      <option key={user.id} value={user.id}>
                        {user.name} ({user.email || user.id})
                      </option>
                    ))}
                </select>
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 sm:space-x-3">
              <button
                onClick={() => {
                  setShowAddUserModal(false);
                  setSelectedUserToAdd('');
                }}
                disabled={isAddingUser}
                className="w-full sm:w-auto px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddUserToGroup}
                disabled={isAddingUser || !selectedUserToAdd}
                className="w-full sm:w-auto px-4 py-2 text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAddingUser ? 'Adding...' : 'Add User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audio / Video call overlays - rendered via portal to overlay entire app */}
      {/* ── Forward / Share Modal ──────────────────────────────────────── */}
      {showForwardModal && forwardMsg !== null && typeof document !== 'undefined' &&
        createPortal(
          <ForwardModal
            message={forwardMsg}
            groups={apiGroups}
            users={users}
            currentUser={currentUser}
            directChats={directChats}
            onClose={closeForwardModal}
            onSendToChat={async (chatId: string) => {
              await apiPostMessages(chatId, forwardMsg);
            }}
          />,
          document.body,
        )}
    </div>
  );
};
