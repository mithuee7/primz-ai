import type {
  AiGeneration,
  AiReview,
  AppSettings,
  ConversationFull,
  ConversationSettings,
  ConversationState,
  GenerationStatus,
  Message,
  SenderType,
  Service,
} from "@/lib/types";
import type { ServiceInput } from "@/lib/schemas";

export interface NewMessage {
  conversation_id: string;
  external_message_id: string | null;
  sender_type: SenderType;
  sender_name: string | null;
  content: string;
  created_at?: string;
  metadata?: Record<string, unknown>;
}

export interface UpsertConversationInput {
  external_thread_id: string;
  lead_external_id: string | null;
  lead_name: string;
  lead_username: string;
  lead_avatar_url: string | null;
}

/**
 * Persistence boundary. Every method is scoped by ownerId, authorization is
 * enforced here (server-side) in addition to Supabase RLS.
 */
export interface Repository {
  /* conversations */
  listConversations(ownerId: string): Promise<ConversationFull[]>;
  getConversation(ownerId: string, id: string): Promise<ConversationFull | null>;
  upsertConversationByThread(ownerId: string, input: UpsertConversationInput): Promise<ConversationFull>;
  updateSettings(ownerId: string, conversationId: string, patch: Partial<Omit<ConversationSettings, "conversation_id">>): Promise<void>;
  updateState(ownerId: string, conversationId: string, patch: Partial<Omit<ConversationState, "conversation_id">>): Promise<void>;
  setConversationServices(ownerId: string, conversationId: string, serviceIds: string[]): Promise<void>;

  /** Best-effort per-conversation processing lock. Returns false if already held. */
  acquireLock(ownerId: string, conversationId: string, ttlMs: number): Promise<boolean>;
  releaseLock(ownerId: string, conversationId: string): Promise<void>;

  /* messages */
  /** Returns created=false (and the existing row) if external_message_id was already stored. */
  addMessage(ownerId: string, msg: NewMessage): Promise<{ message: Message; created: boolean }>;
  /** Oldest to newest. */
  listRecentMessages(ownerId: string, conversationId: string, limit: number): Promise<Message[]>;

  /* services */
  listServices(ownerId: string): Promise<Service[]>;
  saveService(ownerId: string, input: ServiceInput): Promise<Service>;
  deleteService(ownerId: string, id: string): Promise<void>;

  /* AI audit trail */
  createGeneration(
    ownerId: string,
    gen: Pick<AiGeneration, "conversation_id" | "generated_text" | "model" | "prompt_version" | "status" | "error" | "state_update">,
  ): Promise<AiGeneration>;
  updateGeneration(ownerId: string, id: string, patch: Partial<Pick<AiGeneration, "status" | "error" | "generated_text">>): Promise<void>;
  getGeneration(ownerId: string, id: string): Promise<AiGeneration | null>;
  addReview(ownerId: string, review: Omit<AiReview, "id" | "created_at" | "owner_id">): Promise<AiReview>;
  listReviews(ownerId: string, generationId: string): Promise<AiReview[]>;
  listGenerationsByStatus(ownerId: string, status: GenerationStatus): Promise<AiGeneration[]>;
  /** Newest first. */
  listGenerationsForConversation(ownerId: string, conversationId: string, limit: number): Promise<AiGeneration[]>;

  /* settings */
  getAppSettings(ownerId: string): Promise<AppSettings>;
  saveAppSettings(ownerId: string, patch: Partial<Omit<AppSettings, "owner_id">>): Promise<AppSettings>;

  /* demo only */
  resetDemo?(ownerId: string): Promise<void>;
}
