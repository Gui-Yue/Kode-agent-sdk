import { Message, Timeline, Snapshot, AgentInfo, ToolCallRecord, Bookmark, AgentChannel, ToolCallState, BreakpointState } from '../../core/types';
import { TodoSnapshot } from '../../core/todo';

// ============================================================================
// Core Data Structures
// ============================================================================

export interface HistoryWindow {
  id: string;
  messages: Message[];
  events: Timeline[];
  stats: {
    messageCount: number;
    tokenCount: number;
    eventCount: number;
  };
  timestamp: number;
}

export interface CompressionRecord {
  id: string;
  windowId: string;
  config: {
    model: string;
    prompt: string;
    threshold: number;
  };
  summary: string;
  ratio: number;
  recoveredFiles: string[];
  timestamp: number;
}

export interface RecoveredFile {
  path: string;
  content: string;
  mtime: number;
  timestamp: number;
}

export interface MediaCacheRecord {
  key: string;
  provider: string;
  mimeType: string;
  sizeBytes: number;
  fileId?: string;
  fileUri?: string;
  createdAt: number;
}

// ============================================================================
// QueryableStore 相关类型定义
// ============================================================================

/**
 * 查询过滤器类型定义
 */
export interface SessionFilters {
  agentId?: string;
  templateId?: string;
  userId?: string;
  startDate?: number;      // Unix 时间戳（毫秒）
  endDate?: number;        // Unix 时间戳（毫秒）
  limit?: number;          // 最大返回数量
  offset?: number;         // 偏移量（分页）
  sortBy?: 'created_at' | 'updated_at' | 'message_count';
  sortOrder?: 'asc' | 'desc';
}

export interface MessageFilters {
  agentId?: string;
  role?: 'user' | 'assistant' | 'system';
  startDate?: number;
  endDate?: number;
  limit?: number;
  offset?: number;
}

export interface ToolCallFilters {
  agentId?: string;
  toolName?: string;
  state?: ToolCallState;
  startDate?: number;
  endDate?: number;
  limit?: number;
  offset?: number;
}

/**
 * 查询结果类型定义
 */
export interface SessionInfo {
  agentId: string;
  templateId: string;
  createdAt: string;
  messageCount: number;
  lastSfpIndex: number;
  breakpoint?: BreakpointState;
}

export interface AgentStats {
  totalMessages: number;
  totalToolCalls: number;
  totalSnapshots: number;
  avgMessagesPerSession?: number;
  toolCallsByName?: Record<string, number>;
  toolCallsByState?: Record<string, number>;
}

// ============================================================================
// Store Interface - 明确职责分离
// ============================================================================

/**
 * Store 接口定义 Agent 持久化的所有能力
 *
 * 设计原则：
 * 1. 所有方法都是必需的，不使用可选方法
 * 2. 职责清晰：运行时状态、历史管理、事件流、元数据管理
 * 3. 实现无关：接口不暴露存储细节（如 WAL、文件格式等）
 */
export interface Store {
  // ========== 运行时状态管理 ==========

  /** 保存对话消息 */
  saveMessages(agentId: string, messages: Message[]): Promise<void>;
  /** 加载对话消息 */
  loadMessages(agentId: string): Promise<Message[]>;

  /** 保存工具调用记录 */
  saveToolCallRecords(agentId: string, records: ToolCallRecord[]): Promise<void>;
  /** 加载工具调用记录 */
  loadToolCallRecords(agentId: string): Promise<ToolCallRecord[]>;

  /** 保存 Todo 快照 */
  saveTodos(agentId: string, snapshot: TodoSnapshot): Promise<void>;
  /** 加载 Todo 快照 */
  loadTodos(agentId: string): Promise<TodoSnapshot | undefined>;

  // ========== 事件流管理 ==========

  /** 追加事件到流中 */
  appendEvent(agentId: string, timeline: Timeline): Promise<void>;
  /** 读取事件流（支持 Bookmark 续读和 Channel 过滤） */
  readEvents(agentId: string, opts?: { since?: Bookmark; channel?: AgentChannel }): AsyncIterable<Timeline>;

  // ========== 历史与压缩管理 ==========

  /** 保存历史窗口（压缩前的完整快照） */
  saveHistoryWindow(agentId: string, window: HistoryWindow): Promise<void>;
  /** 加载所有历史窗口 */
  loadHistoryWindows(agentId: string): Promise<HistoryWindow[]>;

  /** 保存压缩记录 */
  saveCompressionRecord(agentId: string, record: CompressionRecord): Promise<void>;
  /** 加载所有压缩记录 */
  loadCompressionRecords(agentId: string): Promise<CompressionRecord[]>;

  /** 保存恢复文件快照 */
  saveRecoveredFile(agentId: string, file: RecoveredFile): Promise<void>;
  /** 加载所有恢复文件 */
  loadRecoveredFiles(agentId: string): Promise<RecoveredFile[]>;

  // ========== 多模态缓存管理 ==========

  /** 保存多模态缓存 */
  saveMediaCache(agentId: string, records: MediaCacheRecord[]): Promise<void>;
  /** 加载多模态缓存 */
  loadMediaCache(agentId: string): Promise<MediaCacheRecord[]>;

  // ========== 快照管理 ==========

  /** 保存快照 */
  saveSnapshot(agentId: string, snapshot: Snapshot): Promise<void>;
  /** 加载指定快照 */
  loadSnapshot(agentId: string, snapshotId: string): Promise<Snapshot | undefined>;
  /** 列出所有快照 */
  listSnapshots(agentId: string): Promise<Snapshot[]>;

  // ========== 元数据管理 ==========

  /** 保存 Agent 元信息 */
  saveInfo(agentId: string, info: AgentInfo): Promise<void>;
  /** 加载 Agent 元信息 */
  loadInfo(agentId: string): Promise<AgentInfo | undefined>;

  // ========== 生命周期管理 ==========

  /** 检查 Agent 是否存在 */
  exists(agentId: string): Promise<boolean>;
  /** 删除 Agent 所有数据 */
  delete(agentId: string): Promise<void>;
  /** 列出所有 Agent ID */
  list(prefix?: string): Promise<string[]>;
}

// ============================================================================
// QueryableStore Interface - 扩展 Store 提供查询能力
// ============================================================================

/**
 * QueryableStore 接口
 * 扩展 Store 接口，提供查询能力
 *
 * 设计原则：
 * 1. 继承 Store 的所有能力
 * 2. 新增查询和聚合统计方法
 * 3. 支持灵活的过滤和分页
 */
export interface QueryableStore extends Store {
  /**
   * 查询 Agent 会话信息
   * @param filters - 过滤条件
   * @returns 符合条件的会话信息列表
   */
  querySessions(filters: SessionFilters): Promise<SessionInfo[]>;

  /**
   * 查询消息
   * @param filters - 过滤条件
   * @returns 符合条件的消息列表
   */
  queryMessages(filters: MessageFilters): Promise<Message[]>;

  /**
   * 查询工具调用记录
   * @param filters - 过滤条件
   * @returns 符合条件的工具调用记录列表
   */
  queryToolCalls(filters: ToolCallFilters): Promise<ToolCallRecord[]>;

  /**
   * 聚合统计
   * @param agentId - Agent ID
   * @returns Agent 的统计信息
   */
  aggregateStats(agentId: string): Promise<AgentStats>;
}
