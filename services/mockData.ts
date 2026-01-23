
import { User, UserRole, Task, TaskType, TaskStatus, Project, ChatGroup, Message, AttendanceRecord, Tour } from '../types';

// Users
export const MOCK_USERS: User[] = [
  {
    id: 'u1',
    name: 'Tushar Patil',
    // Professional male photo
    avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=256&h=256',
    role: UserRole.MD,
    designation: 'MD',
    joinDate: '2020-01-01',
    birthDate: '1980-05-15',
    email: 'md@planeteye.com',
    status: 'PRESENT',
    leaveBalance: 30,
    score: 950,
    password: '123',
    branch: 'TECH'
  },
  {
    id: 'u2',
    name: 'Pankaj Jadhav',
    // Professional male photo
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=256&h=256',
    role: UserRole.ADMIN,
    designation: 'Admin & HR',
    joinDate: '2020-03-10',
    birthDate: '1985-08-20',
    email: 'admin@planeteye.com',
    status: 'PRESENT',
    leaveBalance: 20,
    score: 800,
    password: '123',
    branch: 'INFRA_CORE'
  },
  {
    id: 'u3',
    name: 'Shubham Naikwadi',
    // Professional male photo
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&q=80&w=256&h=256',
    role: UserRole.TEAM_LEADER,
    designation: 'Backend Developer',
    joinDate: '2021-01-15',
    birthDate: '1990-12-01',
    teamId: 't1',
    email: 'shubham@planeteye.com',
    status: 'PRESENT',
    leaveBalance: 15,
    score: 750,
    password: '123',
    branch: 'TECH'
  },
  {
    id: 'u4',
    name: 'Vishal Bhor',
    // Young professional male photo
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=256&h=256',
    role: UserRole.EMPLOYEE,
    designation: 'AI/ML Developer',
    joinDate: '2022-06-01',
    birthDate: '1995-02-14',
    teamId: 't1',
    email: 'vishal@planeteye.com',
    status: 'ON_LEAVE',
    leaveBalance: 10,
    score: 600,
    password: '123',
    branch: 'TECH'
  },
  {
    id: 'u5',
    name: 'Manali Patil',
    // Professional female photo
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=256&h=256',
    role: UserRole.INTERN,
    designation: 'Web Developer',
    joinDate: '2023-09-01',
    birthDate: new Date().toISOString().split('T')[0], // Birthday today for demo!
    teamId: 't1',
    email: 'manali@planeteye.com',
    status: 'PRESENT',
    leaveBalance: 0,
    score: 300,
    password: '123',
    branch: 'FARM_CORE'
  },
  {
    id: 'u6',
    name: 'Rohan Sharma',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=256&h=256',
    role: UserRole.EMPLOYEE,
    designation: 'Python Developer',
    joinDate: '2023-01-15',
    birthDate: '1996-03-22',
    teamId: 't1',
    email: 'rohan@planeteye.com',
    status: 'PRESENT',
    leaveBalance: 5,
    score: 450,
    password: '123',
    branch: 'TECH'
  },
  {
    id: 'u7',
    name: 'Sneha Gupta',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=256&h=256',
    role: UserRole.EMPLOYEE,
    designation: 'Software Developer',
    joinDate: '2022-11-10',
    birthDate: '1997-07-08',
    teamId: 't1',
    email: 'sneha@planeteye.com',
    status: 'PRESENT',
    leaveBalance: 8,
    score: 520,
    password: '123',
    branch: 'INFRA_TECH'
  }
];

// Projects
export const MOCK_PROJECTS: Project[] = [
  {
    id: 'p1',
    title: 'Project Phoenix',
    branch: 'Development',
    description: 'Revamping the core legacy system with React and Node.js.',
    managerId: 'u1',
    memberIds: ['u3', 'u4', 'u5'],
    status: 'ACTIVE',
    progress: 65
  },
  {
    id: 'p2',
    title: 'Marketing Alpha',
    branch: 'Sales',
    description: 'Q4 Marketing campaign asset generation.',
    managerId: 'u1',
    memberIds: ['u2'],
    status: 'PLANNING',
    progress: 15
  },
  {
    id: 'p3',
    title: 'Farm Automation',
    branch: 'Farm',
    description: 'IOT sensor integration for field monitoring.',
    managerId: 'u1',
    memberIds: ['u5'],
    status: 'COMPLETED',
    progress: 100
  }
];

// Tasks
export const MOCK_TASKS: Task[] = [
  {
    id: 't1',
    title: 'Fix Critical Login Bug',
    description: 'Users cannot login via OAuth. Needs immediate fix.',
    type: TaskType.SOS,
    status: TaskStatus.IN_PROGRESS,
    assigneeId: 'u4',
    reporterId: 'u3',
    projectId: 'p1',
    dueDate: new Date(Date.now() + 86400000).toISOString(),
    priority: 'URGENT',
    createdAt: new Date().toISOString(),
    comments: []
  },
  {
    id: 't2',
    title: 'Design Home Page',
    description: 'Create Figma mockups for the new landing page.',
    type: TaskType.ONE_DAY,
    status: TaskStatus.COMPLETED,
    assigneeId: 'u4',
    reporterId: 'u3',
    projectId: 'p1',
    dueDate: new Date(Date.now() - 86400000).toISOString(),
    priority: 'MEDIUM',
    createdAt: new Date().toISOString(),
    comments: []
  },
  {
    id: 't3',
    title: 'Learn React Hooks',
    description: 'Complete the advanced hooks module.',
    type: TaskType.INDIVIDUAL,
    status: TaskStatus.PENDING,
    assigneeId: 'u5',
    reporterId: 'u3',
    dueDate: new Date(Date.now() + 86400000 * 3).toISOString(),
    priority: 'LOW',
    createdAt: new Date().toISOString(),
    comments: []
  }
];

// Groups
export const MOCK_GROUPS: ChatGroup[] = [
  {
    id: 'g1',
    name: 'General',
    members: ['u1', 'u2', 'u3', 'u4', 'u5'],
    createdBy: 'u1',
    isPrivate: false
  },
  {
    id: 'g2',
    name: 'Dev Team',
    members: ['u3', 'u4', 'u5'],
    createdBy: 'u3',
    isPrivate: true
  }
];

// Messages
export const MOCK_MESSAGES: Message[] = [
  {
    id: 'm1',
    senderId: 'u1',
    channelId: 'g1',
    content: 'Welcome to the new dashboard everyone!',
    type: 'TEXT',
    timestamp: new Date(Date.now() - 10000000).toISOString()
  }
];

// Generate Mock Attendance for the current month
const generateAttendance = (): AttendanceRecord[] => {
  const records: AttendanceRecord[] = [];
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  
  // For each user
  MOCK_USERS.forEach(user => {
    // Generate for previous 15 days
    for (let i = 1; i <= 15; i++) {
       const date = new Date(year, month, today.getDate() - i);
       // Skip weekends randomly for realism (simplified)
       if (date.getDay() === 0 || date.getDay() === 6) continue;
       
       const isAbsent = Math.random() > 0.9; // 10% chance absent
       
       if (!isAbsent) {
          records.push({
            userId: user.id,
            date: date.toISOString().split('T')[0],
            inTime: '09:00',
            outTime: '18:00',
            totalHours: '09:00',
            status: 'PRESENT'
          });
       } else {
         records.push({
            userId: user.id,
            date: date.toISOString().split('T')[0],
            inTime: '-',
            status: 'ABSENT'
          });
       }
    }
    
    // Today's record for some users
    if (user.id !== 'u4') { // Assume u4 is on leave
      records.push({
         userId: user.id,
         date: today.toISOString().split('T')[0],
         inTime: '09:15',
         status: 'PRESENT'
      });
    }
  });
  
  return records;
};

export const MOCK_ATTENDANCE: AttendanceRecord[] = generateAttendance();

export const MOCK_TOURS: Tour[] = [
  {
    id: 'tour1',
    userId: 'u1', // MD
    startDate: new Date(new Date().setDate(new Date().getDate() + 2)).toISOString().split('T')[0],
    endDate: new Date(new Date().setDate(new Date().getDate() + 5)).toISOString().split('T')[0],
    purpose: 'Paris Expo 2023',
    location: 'Paris, France'
  }
];
