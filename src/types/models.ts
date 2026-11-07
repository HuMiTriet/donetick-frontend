export type ApiResponse<T> = {
  res: T
}

export type ChoreStatus = 0 | 1 | 2 | 3

export type ChoreHistoryStatus = 0 | 1 | 2 | 3 | 4 | 5 | 6

export type FrequencyType =
  | 'once'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'
  | 'adaptive'
  | 'interval'
  | 'days_of_the_week'
  | 'day_of_the_month'
  | 'trigger'
  | 'no_repeat'
  | 'always'

export type AssignStrategy =
  | 'random'
  | 'least_assigned'
  | 'least_completed'
  | 'keep_last_assigned'
  | 'random_except_last_assigned'
  | 'round_robin'
  | 'no_assignee'

export type Label = {
  id: number
  name: string
  color: string
  created_by: number
}

export type SubTask = {
  id: number
  orderId: number
  name: string
  completedAt: string | null
  completedBy: number
  parentId: number | null
}

export type StorageFile = {
  file_path: string
  file_name: string
  size_bytes: number
  user_id: number
  entity_id: number
  entity_type: string
  draft_id?: string
  created_at: number
  sign?: string
}

export type ChoreAssignee = {
  userId: number
}

export type FrequencyMetadata = {
  days?: (string | null)[]
  months?: (string | null)[]
  unit: string | null
  time: string
  timezone: string
  weekPattern: string | null
  weekNumbers?: number[]
  occurrences?: (number | null)[]
}

export type NotificationTemplate = {
  value: number
  unit: string
}

export type NotificationMetadata = {
  dueDate?: boolean
  completion?: boolean
  nagging?: boolean
  predue?: boolean
  circleGroup?: boolean
  circleGroupID: number | null
  templates?: NotificationTemplate[]
}

export type ThingChore = {
  thingId: number
  choreId: number
  triggerState: string
  condition: string
}

export type CompletionAction = {
  thingId: number
  operation: string
  value: string
}

export type Chore = {
  id: number
  name: string
  frequencyType: FrequencyType
  frequency: number
  frequencyMetadata: FrequencyMetadata | null
  nextDueDate: string | null
  isRolling: boolean
  assignedTo: number | null
  assignees: ChoreAssignee[]
  assignStrategy: AssignStrategy
  isActive: boolean
  notification: boolean
  notificationMetadata: NotificationMetadata | null
  labelsV2: Label[] | null
  circleId: number
  createdAt: string
  updatedAt: string
  createdBy: number
  updatedBy: number
  thingChore: ThingChore | null
  status: ChoreStatus
  priority: number
  completionWindow?: number | null
  deadlineOffset?: number | null
  points?: number | null
  description?: string | null
  subTasks?: SubTask[] | null
  requireApproval: boolean
  isPrivate: boolean
  projectId?: number | null
  syncVersion: number
  attachments?: StorageFile[]
  completionActions: CompletionAction[]
}

export type ChoreDetail = {
  id: number
  name: string
  description: string | null
  frequencyType: FrequencyType
  nextDueDate: string | null
  assignedTo: number | null
  lastCompletedDate: string | null
  lastCompletedBy: number | null
  totalCompletedCount: number
  priority: number
  notes: string | null
  createdBy: number
  completionWindow?: number | null
  subTasks?: SubTask[] | null
  assignees: ChoreAssignee[]
  status: ChoreStatus
  duration: number
  startTime: string | null
  timerUpdatedAt: string | null
  projectId?: number | null
  isActive: boolean
  syncVersion: number
  attachments?: StorageFile[]
}

export type ChoreHistory = {
  id: number
  choreId: number
  performedAt: string | null
  completedBy: number
  assignedTo: number | null
  notes: string | null
  dueDate: string | null
  updatedAt: string | null
  createdAt: string
  status: ChoreHistoryStatus
  points?: number | null
  duration?: number | null
  syncVersion: number
}

export type User = {
  id: number
  displayName: string
  username: string
  email: string
  provider: number
  circleID: number
  chatID: number
  image: string
  timezone: string
  parentUserId?: number | null
  userType: number
  mfaEnabled: boolean
  disabled: boolean
  subscription: string | null
  expiration: string | null
}

export type CircleMember = {
  id: number
  userId: number
  circleId: number
  role: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  points: number
  pointsRedeemed: number
  username: string
  displayName: string
  image: string
}
