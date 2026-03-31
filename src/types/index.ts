export type User = {
  id: number;
  username: string;
  email: string;
  roles: string[];
  permissions: string[];
};

export type AuthState = {
  user: User | null;
  access: string | null;
  refresh: string | null;
  isAuthenticated: boolean;
};

export type LoginResponse = {
  access: string;
  refresh: string;
  user: User;
};

export type Project = {
  id: number;
  name: string;
  description: string;
  image?: string;
  featured?: boolean;
  url?: string;
  members_count: number;
  created_by?: number | null;
  created_at: string;
  due_date: string | null;
  members: ProjectMember[];
};

export type ProjectMember = {
  id: number;
  user: {
    id: number;
    username: string;
    email: string;
  };
  role: string;
  added_at: string;
};

export type Task = {
  id: number;
  project: number;
  title: string;
  description: string;
  created_by: number | null;
  assigned_to: number | null;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  start_from: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  helpers: { id: number; username: string; email: string }[];
  subtasks: SubTask[];
};

export type SubTask = {
  id: number;
  task: number;
  title: string;
  description: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  created_by: number | null;
  created_at: string;
  updated_at: string;
};

export type DashboardStats = {
  projects_in_progress: number;
  total_projects: number;
  completed_projects: number;
  tasks_pending: number;
  total_tasks: number;
  tasks_in_progress: number;
  tasks_completed: number;
  sub_tasks_pending: number;
  total_sub_tasks: number;
  sub_tasks_completed: number;
  developers_count: number;
};

export type UserStatus = 'available' | 'busy' | 'away' | 'offline';

export type OnlineUser = {
  id: number;
  username: string;
  email: string;
  status: UserStatus;
  is_online: boolean;
  last_activity: string;
  last_seen: string;
};
