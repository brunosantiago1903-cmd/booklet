// Tipos do banco, espelhando supabase/migrations. Atualize junto com as migrations
// (ou gere com `supabase gen types typescript --linked` quando houver projeto vinculado).

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type AccountType = "checking" | "credit_card";
type CategoryKind = "income" | "expense";
type TransactionType = "income" | "expense" | "transfer";
type TransactionStatus = "pending" | "cleared";
type TransactionSource = "manual" | "receipt" | "open_finance" | "ofx";
type CategorySource = "user" | "rule" | "ai";
type ReceiptStatus = "uploaded" | "extracted" | "failed" | "confirmed";

export type Database = {
  __InternalSupabase: { PostgrestVersion: "13" };
  public: {
    Tables: {
      households: {
        Row: { id: string; name: string; created_at: string };
        Insert: { id?: string; name?: string; created_at?: string };
        Update: { id?: string; name?: string; created_at?: string };
        Relationships: [];
      };
      members: {
        Row: {
          id: string;
          household_id: string;
          user_id: string;
          email: string;
          display_name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          user_id: string;
          email: string;
          display_name: string;
          created_at?: string;
        };
        Update: { display_name?: string };
        Relationships: [];
      };
      accounts: {
        Row: {
          id: string;
          household_id: string;
          owner_member_id: string | null;
          name: string;
          type: AccountType;
          institution: string | null;
          initial_balance_cents: number;
          credit_limit_cents: number | null;
          closing_day: number | null;
          due_day: number | null;
          archived: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id?: string;
          owner_member_id?: string | null;
          name: string;
          type: AccountType;
          institution?: string | null;
          initial_balance_cents?: number;
          credit_limit_cents?: number | null;
          closing_day?: number | null;
          due_day?: number | null;
          archived?: boolean;
          created_at?: string;
        };
        Update: {
          owner_member_id?: string | null;
          name?: string;
          institution?: string | null;
          initial_balance_cents?: number;
          credit_limit_cents?: number | null;
          closing_day?: number | null;
          due_day?: number | null;
          archived?: boolean;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          household_id: string;
          parent_id: string | null;
          name: string;
          kind: CategoryKind;
          color: string | null;
          archived: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id?: string;
          parent_id?: string | null;
          name: string;
          kind: CategoryKind;
          color?: string | null;
          archived?: boolean;
          created_at?: string;
        };
        Update: { parent_id?: string | null; name?: string; color?: string | null; archived?: boolean };
        Relationships: [];
      };
      receipts: {
        Row: {
          id: string;
          household_id: string;
          uploaded_by: string | null;
          storage_path: string;
          mime_type: string;
          file_name: string | null;
          status: ReceiptStatus;
          extraction: Json | null;
          error: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id?: string;
          uploaded_by?: string | null;
          storage_path: string;
          mime_type: string;
          file_name?: string | null;
          status?: ReceiptStatus;
          extraction?: Json | null;
          error?: string | null;
          created_at?: string;
        };
        Update: { status?: ReceiptStatus; extraction?: Json | null; error?: string | null };
        Relationships: [];
      };
      transactions: {
        Row: {
          id: string;
          household_id: string;
          account_id: string;
          category_id: string | null;
          category_source: CategorySource | null;
          type: TransactionType;
          amount_cents: number;
          date: string;
          invoice_month: string | null;
          description: string;
          original_description: string | null;
          notes: string | null;
          status: TransactionStatus;
          transfer_group_id: string | null;
          installment_group_id: string | null;
          installment_number: number | null;
          installment_total: number | null;
          source: TransactionSource;
          external_id: string | null;
          receipt_id: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id?: string;
          account_id: string;
          category_id?: string | null;
          category_source?: CategorySource | null;
          type: TransactionType;
          amount_cents: number;
          date: string;
          invoice_month?: string | null;
          description: string;
          original_description?: string | null;
          notes?: string | null;
          status?: TransactionStatus;
          transfer_group_id?: string | null;
          installment_group_id?: string | null;
          installment_number?: number | null;
          installment_total?: number | null;
          source?: TransactionSource;
          external_id?: string | null;
          receipt_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          category_id?: string | null;
          category_source?: CategorySource | null;
          type?: TransactionType;
          amount_cents?: number;
          date?: string;
          invoice_month?: string | null;
          description?: string;
          original_description?: string | null;
          notes?: string | null;
          status?: TransactionStatus;
          transfer_group_id?: string | null;
          installment_group_id?: string | null;
          installment_number?: number | null;
          installment_total?: number | null;
          source?: TransactionSource;
          external_id?: string | null;
          receipt_id?: string | null;
        };
        Relationships: [];
      };
      category_rules: {
        Row: { id: string; household_id: string; pattern: string; category_id: string; created_at: string };
        Insert: { id?: string; household_id?: string; pattern: string; category_id: string; created_at?: string };
        Update: { pattern?: string; category_id?: string };
        Relationships: [];
      };
      budgets: {
        Row: { id: string; household_id: string; category_id: string; amount_cents: number; created_at: string };
        Insert: { id?: string; household_id?: string; category_id: string; amount_cents: number; created_at?: string };
        Update: { amount_cents?: number };
        Relationships: [];
      };
      bank_connections: {
        Row: {
          id: string;
          household_id: string;
          member_id: string | null;
          provider: "pluggy";
          label: string;
          client_id: string;
          client_secret_encrypted: string;
          item_id: string;
          last_synced_at: string | null;
          last_sync_status: "ok" | "error" | null;
          last_error: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id?: string;
          member_id?: string | null;
          provider?: "pluggy";
          label: string;
          client_id: string;
          client_secret_encrypted: string;
          item_id: string;
          last_synced_at?: string | null;
          last_sync_status?: "ok" | "error" | null;
          last_error?: string | null;
          created_at?: string;
        };
        Update: {
          member_id?: string | null;
          label?: string;
          client_id?: string;
          client_secret_encrypted?: string;
          last_synced_at?: string | null;
          last_sync_status?: "ok" | "error" | null;
          last_error?: string | null;
        };
        Relationships: [];
      };
      bank_account_links: {
        Row: {
          id: string;
          household_id: string;
          connection_id: string;
          external_account_id: string;
          external_name: string;
          external_type: string;
          external_subtype: string | null;
          account_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id?: string;
          connection_id: string;
          external_account_id: string;
          external_name: string;
          external_type: string;
          external_subtype?: string | null;
          account_id?: string | null;
          created_at?: string;
        };
        Update: {
          external_name?: string;
          external_type?: string;
          external_subtype?: string | null;
          account_id?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      account_balances: {
        Row: { account_id: string; household_id: string; balance_cents: number };
        Relationships: [];
      };
      card_invoices: {
        Row: {
          household_id: string;
          account_id: string;
          invoice_month: string;
          charges_cents: number;
          payments_cents: number;
          transaction_count: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      current_household_id: { Args: Record<string, never>; Returns: string };
      seed_default_categories: { Args: { p_household_id: string }; Returns: undefined };
      bootstrap_member: {
        Args: { p_user_id: string; p_email: string; p_display_name: string };
        Returns: string;
      };
    };
    Enums: {
      account_type: AccountType;
      category_kind: CategoryKind;
      transaction_type: TransactionType;
      transaction_status: TransactionStatus;
      transaction_source: TransactionSource;
      category_source: CategorySource;
      receipt_status: ReceiptStatus;
    };
    CompositeTypes: { [_ in never]: never };
  };
};

type PublicSchema = Database["public"];
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"];
export type Views<T extends keyof PublicSchema["Views"]> = PublicSchema["Views"][T]["Row"];
