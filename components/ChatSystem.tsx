
import React, { useState, useEffect, useRef } from 'react';
import { Message, ChatGroup, User, UserRole } from '../types';
import { Send, Image, Smile, Paperclip, PlusCircle, Users, Hash, X, Check, UserPlus, Trash2 } from 'lucide-react';
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
  getMessages as apiGetMessages
} from '../services/api';

interface ChatSystemProps {
  currentUser: User;
  groups: ChatGroup[];
  messages: Message[];
  users: User[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setGroups: React.Dispatch<React.SetStateAction<ChatGroup[]>>;
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
  const [apiGroups, setApiGroups] = useState<Array<{group_id: number; name: string; description: string; created_at: string}>>([]);
  const [groupMembers, setGroupMembers] = useState<Record<string | number, string[]>>({});
  const [showMembersPanel, setShowMembersPanel] = useState(false);
  const [currentGroupMembers, setCurrentGroupMembers] = useState<Array<{participant_name: string}>>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [lastFetchedGroupId, setLastFetchedGroupId] = useState<number | null>(null);
  const fetchingRef = useRef<Record<number, boolean>>({});
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [selectedUserToAdd, setSelectedUserToAdd] = useState<string>('');
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [apiMessages, setApiMessages] = useState<Array<{sender: string; message: string; date: string; time: string}>>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [directChats, setDirectChats] = useState<Record<string, string>>({}); // Map user ID/name to chat_id
  const [isStartingChat, setIsStartingChat] = useState(false);

  // Permission: Can create group?
  const canCreateGroup = [UserRole.MD, UserRole.ADMIN, UserRole.TEAM_LEADER].includes(currentUser.role);

  // Helper to convert API group format to ChatGroup (defined before use)
  const convertApiGroupsToChatGroups = (apiGroups: any[], membersMap: Record<string | number, string[]>) =>
    apiGroups.map((g: any) => ({
      id: `g${g.group_id}`,
      name: g.group_name || g.name || '',
      members: membersMap[g.group_id] || [],
      createdBy: g.created_by || '',
      isPrivate: false,
      groupId: g.group_id,
      totalParticipant: typeof g.total_participant === 'number' ? g.total_participant : (g.total_participant != null ? Number(g.total_participant) : undefined),
    }));

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
          chats.forEach((chat: any) => {
            const chatWith = chat.with || '';
            let chatId = chat.chat_id ? String(chat.chat_id).trim() : '';
            if (chatWith && chatId) {
              chatMap[chatWith] = chatId;
              const matchingUser = users.find((u: User) =>
                u.name === chatWith || u.id === chatWith || String(u.id).includes(chatWith) ||
                chatWith.includes(u.name) || chatWith.includes(String(u.id))
              );
              if (matchingUser) {
                chatMap[matchingUser.name] = chatId;
                chatMap[matchingUser.id] = chatId;
                if ((matchingUser as any).Employee_id) chatMap[(matchingUser as any).Employee_id] = chatId;
              }
            }
          });
          setDirectChats(prev => ({ ...prev, ...chatMap }));
          setApiGroups(groups.map((g: any) => ({
            group_id: g.group_id,
            name: g.group_name || g.name || '',
            description: g.description || '',
            created_at: '',
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
        throw new Error('You do not have permission to create groups. Only MD, Admin, and Team Leader can create groups.');
      }
      
      await apiCreateGroup(groupData);
      
      // Reset form
      setNewGroupName('');
      setNewGroupDescription('');
      setSelectedParticipants({});
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
      chats.forEach((chat: any) => {
        chatMap[chat.with] = chat.chat_id;
      });
      setDirectChats(prev => ({ ...prev, ...chatMap }));
      
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
    if (!activeGroup?.groupId) {
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

      await apiAddUserToGroup(Number(activeGroup.groupId), employeeId);

      // Show success message
      alert('User added successfully!');

      // Reset form
      setSelectedUserToAdd('');
      setShowAddUserModal(false);

      // Refresh group members and employees
      if (activeGroup.groupId != null) {
        const members = await apiShowGroupMembers(Number(activeGroup.groupId));
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
    if (!activeGroup?.groupId) {
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
      const response = await apiDeleteUserFromGroup(Number(activeGroup.groupId), userId);

      // Check response message
      if (response.Message) {
        if (response.Message.includes("deleted Successfully") || response.Message.includes("Successfully")) {
          alert('User removed successfully!');
          
          // Refresh group members and employees
          if (activeGroup.groupId) {
            const members = await apiShowGroupMembers(Number(activeGroup.groupId));
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
    if (!activeGroup?.groupId) {
      alert('Please select a group first');
      return;
    }

    // Check if user has permission (only group creator can delete)
    if (!canCreateGroup) {
      alert('Only group creators (MD, Admin, Team Lead) can delete groups');
      return;
    }

    // Confirm deletion
    if (!confirm(`Are you sure you want to delete the group "${activeGroup.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await apiDeleteGroup(Number(activeGroup.groupId));

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
          members: [],
          createdBy: '',
          isPrivate: false,
          groupId: g.group_id,
        }));
        
        // Update direct chats
        const chats = chatData.chats_info || [];
        const chatMap: Record<string, string> = {};
        chats.forEach((chat: any) => {
          chatMap[chat.with] = chat.chat_id;
        });
        setDirectChats(prev => ({ ...prev, ...chatMap }));
        
        // Also update apiGroups for compatibility
        const apiGroupsFormat = groups.map((g: any) => ({
          group_id: g.group_id,
          name: g.group_name || g.name || '',
          description: g.description || '',
          created_at: '',
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

  // Helper function to find chat_id for a user
  const findChatIdForUser = (user: User): string | null => {
    // Try multiple lookup keys
    const possibleKeys: (string | number)[] = [
      user.name,
      user.id,
      String(user.id),
      (user as any).Employee_id,
      (user as any)['Employee ID'],
    ].filter((key): key is string | number => key != null && key !== '');
    
    for (const key of possibleKeys) {
      const keyStr = String(key);
      const chatId = directChats[keyStr];
      if (chatId && typeof chatId === 'string' && chatId.trim() !== '') {
        return chatId;
      }
    }
    
    // Also try to find by partial match in directChats keys
    for (const [chatKey, chatId] of Object.entries(directChats)) {
      if (chatId && typeof chatId === 'string' && chatId.trim() !== '') {
        if (
          chatKey === user.name ||
          chatKey === String(user.id) ||
          (typeof user.id === 'string' && chatKey === user.id) ||
          (typeof user.name === 'string' && chatKey.includes(user.name)) ||
          (typeof user.name === 'string' && user.name.includes(chatKey)) ||
          (typeof user.id === 'string' && chatKey.includes(user.id)) ||
          (typeof user.id === 'string' && user.id.includes(chatKey)) ||
          chatKey.includes(String(user.id)) ||
          String(user.id).includes(chatKey)
        ) {
          return chatId;
        }
      }
    }
    
    return null;
  };

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
        await new Promise(resolve => setTimeout(resolve, 1000)); // Increased wait time
        
        // Reload chats multiple times if needed to get the chat_id
        let chatIdFound = false;
        let retryCount = 0;
        const maxRetries = 3;
        
        while (!chatIdFound && retryCount < maxRetries) {
          try {
            const chatData = await apiLoadChats();
            const chats = chatData.chats_info || [];
            const chatMap: Record<string, string> = {};
            
            chats.forEach((chat: any) => {
              const chatWith = chat.with || '';
              const chatId = chat.chat_id || '';
              
              if (chatWith && chatId) {
                chatMap[chatWith] = chatId;
                
                // Also map to user if we can match it - try multiple matching strategies
                const matchesUser = 
                  chatWith === user.name || 
                  chatWith === user.id || 
                  chatWith === String(user.id) || 
                  chatWith === employeeId ||
                  (typeof user.name === 'string' && chatWith.includes(user.name)) ||
                  (typeof user.name === 'string' && user.name.includes(chatWith)) ||
                  (typeof employeeId === 'string' && chatWith.includes(employeeId)) ||
                  (typeof employeeId === 'string' && employeeId.includes(chatWith));
                
                if (matchesUser) {
                  chatMap[user.name] = chatId;
                  chatMap[user.id] = chatId;
                  if (employeeId) chatMap[employeeId] = chatId;
                  // Also try with Employee_id variations
                  if ((user as any).Employee_id) {
                    chatMap[String((user as any).Employee_id)] = chatId;
                  }
                }
              }
            });
            
            setDirectChats(prev => ({ ...prev, ...chatMap }));
            
            // Verify we now have a chat_id for this user
            const newChatId = findChatIdForUser(user);
            if (newChatId && newChatId.trim() !== '') {
              chatIdFound = true;
            } else {
              retryCount++;
              if (retryCount < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait before retry
              }
            }
          } catch (reloadError) {
            console.error('Error reloading chats:', reloadError);
            retryCount++;
            if (retryCount < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 1000));
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
    const fetchMessages = async () => {
      if (!activeGroup && !activeUser) {
        setApiMessages([]);
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
              chats.forEach((chat: any) => {
                if (chat.with && chat.chat_id) {
                  chatMap[chat.with] = chat.chat_id;
                  // Try to match with active user
                  if (chat.with === activeUser.name || chat.with === activeUser.id || 
                      chat.with === String(activeUser.id) || chat.with.includes(activeUser.name)) {
                    chatMap[activeUser.name] = chat.chat_id;
                    chatMap[activeUser.id] = chat.chat_id;
                  }
                }
              });
              setDirectChats(prev => ({ ...prev, ...chatMap }));
              
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
  const handleSend = async () => {
    if (!input.trim() || isSendingMessage) return;
    
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
        const maxRetries = 3;
        
        while (!chatIdFound && retryCount < maxRetries) {
          try {
            const chatData = await apiLoadChats();
            const chats = chatData.chats_info || [];
            const chatMap: Record<string, string> = {};
            
            chats.forEach((chat: any) => {
              const chatWith = chat.with || '';
              const chatIdValue = chat.chat_id || '';
              
              if (chatWith && chatIdValue) {
                chatMap[chatWith] = chatIdValue;
                
                // Try multiple matching strategies
                if (chatWith === activeUser.name || chatWith === activeUser.id || 
                    chatWith === String(activeUser.id) || 
                    (typeof activeUser.name === 'string' && chatWith.includes(activeUser.name)) ||
                    (typeof activeUser.name === 'string' && activeUser.name.includes(chatWith))) {
                  chatMap[activeUser.name] = chatIdValue;
                  chatMap[activeUser.id] = chatIdValue;
                  // Also try Employee_id if available
                  if ((activeUser as any).Employee_id) {
                    chatMap[String((activeUser as any).Employee_id)] = chatIdValue;
                  }
                }
              }
            });
            
            setDirectChats(prev => ({ ...prev, ...chatMap }));
            
            // Try to find chat_id again
            chatId = findChatIdForUser(activeUser) || '';
            if (chatId && chatId.trim() !== '') {
              chatIdFound = true;
            } else {
              retryCount++;
              if (retryCount < maxRetries) await new Promise(resolve => setTimeout(resolve, 500));
            }
          } catch (reloadError) {
            console.error('Error reloading chats:', reloadError);
            retryCount++;
            if (retryCount < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 500));
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
          chats.forEach((chat: any) => {
            if (chat.with && chat.chat_id) {
              chatMap[chat.with] = chat.chat_id;
              if (chat.with === activeUser.name || chat.with === activeUser.id || 
                  chat.with === String(activeUser.id) || chat.with.includes(activeUser.name)) {
                chatMap[activeUser.name] = chat.chat_id;
                chatMap[activeUser.id] = chat.chat_id;
              }
            }
          });
          setDirectChats(prev => ({ ...prev, ...chatMap }));
          chatId = findChatIdForUser(activeUser) || chatId;
          
          if (!chatId || (typeof chatId === 'string' && chatId.trim() === '')) {
            alert('Chat not found. Please click on the user again to start the chat.');
            return;
          }
        }
      }
      
      // Send message - backend expects array format: ["Message"]
      await apiPostMessages(chatId, messageText);
      
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
        chats.forEach((chat: any) => {
          const chatWith = chat.with || '';
          const chatId = chat.chat_id || '';
          
          if (chatWith && chatId) {
            chatMap[chatWith] = chatId;
            
            // Also map to active user if we can match it
            if (chatWith === activeUser.name || chatWith === activeUser.id || 
                chatWith === String(activeUser.id) || chatWith.includes(activeUser.name) ||
                activeUser.name.includes(chatWith)) {
              chatMap[activeUser.name] = chatId;
              chatMap[activeUser.id] = chatId;
            }
          }
        });
        setDirectChats(prev => ({ ...prev, ...chatMap }));
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      alert(error.message || 'Failed to send message. Please try again.');
    } finally {
      setIsSendingMessage(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-140px)] bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-200">
      {/* Sidebar List */}
      <div className="w-1/3 border-r border-gray-200 flex flex-col bg-gray-50/50">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-white">
          <h3 className="font-bold text-gray-800 text-lg">Messages</h3>
          {canCreateGroup && (
             <button onClick={() => setShowCreateModal(true)} title="New Group" className="text-white bg-brand-600 hover:bg-brand-700 p-2 rounded-lg shadow-sm transition-colors">
               <PlusCircle size={20} />
             </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {/* Groups Section */}
          <div className="space-y-1">
            {isLoadingGroups ? (
              <div className="text-center text-gray-400 py-8">Loading groups...</div>
            ) : groups.length === 0 ? (
              <div className="text-center text-gray-400 py-8">No groups yet</div>
            ) : (
              groups.map(group => (
            <div 
              key={group.id} 
                  onClick={() => handleGroupClick(group)}
                  className={`p-3 cursor-pointer rounded-xl transition-all ${activeGroup?.id === group.id ? 'bg-white shadow-md border border-gray-100' : 'hover:bg-gray-100 text-gray-600'}`}
            >
              <div className="flex items-center space-x-3">
                 <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-sm ${group.isPrivate ? 'bg-indigo-500' : 'bg-brand-500'}`}>
                   {group.isPrivate ? <Users size={18} /> : <Hash size={18} />}
                 </div>
                 <div>
                       <p className={`font-semibold text-sm ${activeGroup?.id === group.id ? 'text-gray-900' : 'text-gray-700'}`}>{group.name}</p>
                       <p className="text-xs text-gray-400">
                         {(() => {
                           const count = group.totalParticipant ??
                             (groupMembers[(group as any).groupId]?.length) ??
                             (group.members?.length);
                           return count != null ? `${count} members` : 'Loading members...';
                         })()}
                       </p>
                     </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* All Users Section */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider px-3 mb-2">All Users</h4>
            {users.length === 0 ? (
              <div className="text-center text-gray-400 py-4 text-sm">No users found</div>
            ) : (
              <div className="space-y-1">
                {users.map(user => {
                  // Create DM channel ID for highlighting
                  const userIds = [currentUser.id, user.id].sort();
                  const dmChannelId = `dm-${userIds[0]}-${userIds[1]}`;
                  const hasMessages = messages.some(m => m.channelId === dmChannelId);
                  const isActive = activeUser?.id === user.id;
                  
                  return (
                    <div
                      key={user.id}
                      onClick={() => handleUserClick(user)}
                      className={`p-2 cursor-pointer rounded-lg transition-colors ${
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
        <div className="w-2/3 flex flex-col bg-white relative">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex justify-between items-center shadow-sm z-10">
          <div className="flex items-center space-x-3">
              {activeGroup ? (
                <>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white ${activeGroup.isPrivate ? 'bg-indigo-500' : 'bg-brand-500'}`}>
               {activeGroup.isPrivate ? <Users size={16} /> : <Hash size={16} />}
            </div>
            <div>
               <span className="font-bold text-gray-800 text-base block leading-none">{activeGroup.name}</span>
                    <span className="text-xs text-gray-500">
                      {(() => {
                        const memberCount = activeGroup.totalParticipant ??
                          groupMembers[(activeGroup as any).groupId]?.length ??
                          activeGroup.members?.length ?? 0;
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
                  <div>
                    <span className="font-bold text-gray-800 text-base block leading-none">{activeUser.name}</span>
                    <span className="text-xs text-gray-500">{activeUser.email || activeUser.designation || activeUser.role}</span>
                  </div>
                </>
              ) : null}
            </div>
            {activeGroup && (
              <button
                onClick={() => setShowMembersPanel(!showMembersPanel)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                  showMembersPanel 
                    ? 'bg-brand-600 text-white' 
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                }`}
                title="Show group members"
              >
                <Users size={18} />
                <span className="text-sm font-medium">
                  {(() => {
                    return activeGroup.totalParticipant ??
                      groupMembers[(activeGroup as any).groupId]?.length ??
                      activeGroup.members?.length ?? 0;
                  })()}
                </span>
              </button>
            )}
        </div>

        {/* Messages */}
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50">
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
              // Parse date in DD/MM/YY format and time in HH:MM format
              const parseDateTime = (date: string, time: string) => {
                if (!date) return 0;
                // Date format: "14/01/26" (DD/MM/YY)
                const dateParts = date.split('/');
                if (dateParts.length === 3) {
                  const day = parseInt(dateParts[0], 10);
                  const month = parseInt(dateParts[1], 10) - 1; // Month is 0-indexed
                  const year = 2000 + parseInt(dateParts[2], 10); // Convert YY to YYYY
                  
                  // Time format: "11:55" (HH:MM)
                  const timeParts = (time || '00:00').split(':');
                  const hours = parseInt(timeParts[0] || '0', 10);
                  const minutes = parseInt(timeParts[1] || '0', 10);
                  
                  return new Date(year, month, day, hours, minutes).getTime();
                }
                return 0;
              };
              
              const dateTimeA = parseDateTime(a.date || '', a.time || '00:00');
              const dateTimeB = parseDateTime(b.date || '', b.time || '00:00');
              
              // Return negative if A is earlier (should come first), positive if B is earlier
              return dateTimeA - dateTimeB;
            }).map((msg, index) => {
              const isMe = msg.sender === currentUser.name || msg.sender === currentUser.id;
              const sender = users.find(u => u.name === msg.sender || u.id === msg.sender);
              return (
                <div key={index} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  {!isMe && (
                    <img src={sender?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(msg.sender)}&background=random`} className="w-8 h-8 rounded-full mr-2 self-end mb-1" alt="" />
                  )}
                  <div className={`max-w-[70%] rounded-2xl p-4 shadow-sm ${isMe ? 'bg-brand-600 text-white rounded-br-none' : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none'}`}>
                    {!isMe && <p className="text-xs font-bold text-brand-600 mb-1">{msg.sender}</p>}
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                    <p className={`text-[10px] mt-2 text-right ${isMe ? 'text-brand-200' : 'text-gray-400'}`}>
                      {msg.date} {msg.time}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 bg-white border-t border-gray-200 relative">
          <div className="flex items-center space-x-2 bg-gray-100 rounded-xl px-4 py-2 border border-gray-200">
            {/* Emoji Picker Button */}
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="text-gray-500 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-200 transition-colors flex-shrink-0"
              title="Add emoji"
            >
              <Smile size={20} />
            </button>

            {/* Emoji Picker */}
            {showEmojiPicker && (
              <div className="emoji-picker-container absolute bottom-16 left-4 bg-white border border-gray-200 rounded-lg shadow-xl p-3 z-50 max-w-xs">
                <div className="grid grid-cols-8 gap-1 max-h-48 overflow-y-auto">
                  {['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👹', '👺', '🤡', '💩', '👻', '💀', '☠️', '👽', '👾', '🤖', '🎃', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾'].map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
                        setInput(input + emoji);
                        setShowEmojiPicker(false);
                      }}
                      className="text-2xl hover:bg-gray-100 rounded p-1 transition-colors"
                      title={emoji}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Type a message..."
              className="flex-1 bg-transparent focus:outline-none text-sm text-gray-700 min-w-0"
            />
            <button 
              onClick={handleSend} 
              disabled={!input.trim() || isSendingMessage}
              className="bg-brand-600 text-white p-2 rounded-lg hover:bg-brand-700 shadow-sm transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Send message"
            >
              {isSendingMessage ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Send size={18} />
              )}
            </button>
          </div>
        </div>

          {/* Group Members Panel - Only show for groups */}
          {showMembersPanel && activeGroup && (
            <div className="absolute right-0 top-0 bottom-0 w-80 bg-white border-l border-gray-200 shadow-xl z-20 flex flex-col">
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
        <div className="w-2/3 flex items-center justify-center bg-gray-50">
          <div className="text-center text-gray-400">
            <Users size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-lg">Select a group or user to start chatting</p>
          </div>
        </div>
      )}

      {/* Create Group Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="text-2xl font-bold text-gray-800">Create New Group</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600 bg-white rounded-full p-2 shadow-sm">
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
                <div className="border border-gray-200 rounded-lg p-4 max-h-64 overflow-y-auto bg-gray-50">
                  {availableEmployees.filter(u => u.id !== currentUser.id && u.id !== '2000').length === 0 ? (
                    <p className="text-sm text-gray-400">No other employees available</p>
                  ) : (
                    <div className="space-y-2">
                      {availableEmployees.filter(u => u.id !== currentUser.id && u.id !== '2000').map(user => (
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
                            <img src={user.avatar || ''} alt={user.name} className="w-8 h-8 rounded-full" />
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
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Selected: {Object.keys(selectedParticipants).length} participant(s)
                </p>
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-100 flex justify-end space-x-3 bg-gray-50">
              <button
                onClick={() => setShowCreateModal(false)}
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
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800">Add User to Group</h3>
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

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowAddUserModal(false);
                  setSelectedUserToAdd('');
                }}
                disabled={isAddingUser}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddUserToGroup}
                disabled={isAddingUser || !selectedUserToAdd}
                className="px-4 py-2 text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAddingUser ? 'Adding...' : 'Add User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
