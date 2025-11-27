export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      ai_creative_analysis: {
        Row: {
          account_id: string
          ad_id: string
          analysis_version: string | null
          company_id: string
          created_at: string
          created_by: string
          id: string
          material_id: string | null
          metrics_analysis: Json | null
          performance_insights: Json | null
          recommendations: Json | null
          updated_at: string
          visual_analysis: Json | null
        }
        Insert: {
          account_id: string
          ad_id: string
          analysis_version?: string | null
          company_id: string
          created_at?: string
          created_by: string
          id?: string
          material_id?: string | null
          metrics_analysis?: Json | null
          performance_insights?: Json | null
          recommendations?: Json | null
          updated_at?: string
          visual_analysis?: Json | null
        }
        Update: {
          account_id?: string
          ad_id?: string
          analysis_version?: string | null
          company_id?: string
          created_at?: string
          created_by?: string
          id?: string
          material_id?: string | null
          metrics_analysis?: Json | null
          performance_insights?: Json | null
          recommendations?: Json | null
          updated_at?: string
          visual_analysis?: Json | null
        }
        Relationships: []
      }
      ai_generated_briefings: {
        Row: {
          briefing_data: Json
          company_id: string
          created_at: string
          created_by: string
          id: string
          metadata: Json | null
          project_id: string | null
          source_account_id: string
          source_ad_id: string
          status: string | null
          updated_at: string
          variations: Json | null
        }
        Insert: {
          briefing_data: Json
          company_id: string
          created_at?: string
          created_by: string
          id?: string
          metadata?: Json | null
          project_id?: string | null
          source_account_id: string
          source_ad_id: string
          status?: string | null
          updated_at?: string
          variations?: Json | null
        }
        Update: {
          briefing_data?: Json
          company_id?: string
          created_at?: string
          created_by?: string
          id?: string
          metadata?: Json | null
          project_id?: string | null
          source_account_id?: string
          source_ad_id?: string
          status?: string | null
          updated_at?: string
          variations?: Json | null
        }
        Relationships: []
      }
      applied_taxonomies: {
        Row: {
          account_id: string
          ad_id: string
          approved_at: string | null
          approved_by: string | null
          company_id: string
          created_at: string
          created_by: string
          generated_taxonomy: string
          id: string
          is_approved: boolean | null
          local_material_id: string | null
          pattern_id: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          ad_id: string
          approved_at?: string | null
          approved_by?: string | null
          company_id: string
          created_at?: string
          created_by: string
          generated_taxonomy: string
          id?: string
          is_approved?: boolean | null
          local_material_id?: string | null
          pattern_id?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          ad_id?: string
          approved_at?: string | null
          approved_by?: string | null
          company_id?: string
          created_at?: string
          created_by?: string
          generated_taxonomy?: string
          id?: string
          is_approved?: boolean | null
          local_material_id?: string | null
          pattern_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      authorized_emails: {
        Row: {
          allowed_companies: Json | null
          company_id: string | null
          created_at: string
          created_by: string | null
          email: string
          id: string
          role: string
          used_at: string | null
        }
        Insert: {
          allowed_companies?: Json | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          email: string
          id?: string
          role: string
          used_at?: string | null
        }
        Update: {
          allowed_companies?: Json | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          role?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "authorized_emails_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          material_id: string
          parent_id: string | null
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          material_id: string
          parent_id?: string | null
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          material_id?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comments_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          id: string
          logo_url: string | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      competitor_ads_cache: {
        Row: {
          ad_copy: string | null
          ad_format: string | null
          ad_id: string
          ad_name: string | null
          company_id: string | null
          created_at: string
          cta_text: string | null
          id: string
          image_urls: Json | null
          is_active: boolean | null
          last_seen: string | null
          link_url: string | null
          page_id: string | null
          page_name: string
          platform_positions: Json | null
          scraped_at: string
          search_keyword: string
          search_niche: string | null
          started_running_date: string | null
          thumbnail_url: string | null
          updated_at: string
          video_url: string | null
        }
        Insert: {
          ad_copy?: string | null
          ad_format?: string | null
          ad_id: string
          ad_name?: string | null
          company_id?: string | null
          created_at?: string
          cta_text?: string | null
          id?: string
          image_urls?: Json | null
          is_active?: boolean | null
          last_seen?: string | null
          link_url?: string | null
          page_id?: string | null
          page_name: string
          platform_positions?: Json | null
          scraped_at?: string
          search_keyword: string
          search_niche?: string | null
          started_running_date?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          ad_copy?: string | null
          ad_format?: string | null
          ad_id?: string
          ad_name?: string | null
          company_id?: string | null
          created_at?: string
          cta_text?: string | null
          id?: string
          image_urls?: Json | null
          is_active?: boolean | null
          last_seen?: string | null
          link_url?: string | null
          page_id?: string | null
          page_name?: string
          platform_positions?: Json | null
          scraped_at?: string
          search_keyword?: string
          search_niche?: string | null
          started_running_date?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competitor_ads_cache_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      competitor_search_history: {
        Row: {
          cache_expires_at: string | null
          company_id: string | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          metadata: Json | null
          search_keyword: string
          search_niche: string | null
          search_status: string | null
          searched_at: string
          searched_by: string
          should_refresh: boolean | null
          total_ads_found: number | null
          updated_at: string
        }
        Insert: {
          cache_expires_at?: string | null
          company_id?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          search_keyword: string
          search_niche?: string | null
          search_status?: string | null
          searched_at?: string
          searched_by: string
          should_refresh?: boolean | null
          total_ads_found?: number | null
          updated_at?: string
        }
        Update: {
          cache_expires_at?: string | null
          company_id?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          search_keyword?: string
          search_niche?: string | null
          search_status?: string | null
          searched_at?: string
          searched_by?: string
          should_refresh?: boolean | null
          total_ads_found?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "competitor_search_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitor_search_history_searched_by_fkey"
            columns: ["searched_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      material_versions: {
        Row: {
          created_at: string
          created_by: string
          file_url: string
          id: string
          material_id: string
          notes: string | null
          thumbnail_url: string | null
          version_number: number
          wireframe_data: Json | null
        }
        Insert: {
          created_at?: string
          created_by: string
          file_url: string
          id?: string
          material_id: string
          notes?: string | null
          thumbnail_url?: string | null
          version_number: number
          wireframe_data?: Json | null
        }
        Update: {
          created_at?: string
          created_by?: string
          file_url?: string
          id?: string
          material_id?: string
          notes?: string | null
          thumbnail_url?: string | null
          version_number?: number
          wireframe_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "material_versions_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          ai_generated_video: boolean | null
          briefing_approved_by_client: boolean | null
          canvas_data: string | null
          caption: string | null
          company_id: string
          copy: string | null
          created_at: string
          created_by: string
          document_canvas_data: Json | null
          file_url: string | null
          id: string
          internal_approval: boolean | null
          internal_approved_at: string | null
          internal_approved_by: string | null
          is_briefing: boolean | null
          is_running: boolean | null
          metadata: Json | null
          name: string
          project_id: string
          reference: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          thumbnail_url: string | null
          type: string
          updated_at: string
          version_count: number | null
          visualization_html: string | null
          wireframe_data: Json | null
        }
        Insert: {
          ai_generated_video?: boolean | null
          briefing_approved_by_client?: boolean | null
          canvas_data?: string | null
          caption?: string | null
          company_id: string
          copy?: string | null
          created_at?: string
          created_by: string
          document_canvas_data?: Json | null
          file_url?: string | null
          id?: string
          internal_approval?: boolean | null
          internal_approved_at?: string | null
          internal_approved_by?: string | null
          is_briefing?: boolean | null
          is_running?: boolean | null
          metadata?: Json | null
          name: string
          project_id: string
          reference?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          thumbnail_url?: string | null
          type: string
          updated_at?: string
          version_count?: number | null
          visualization_html?: string | null
          wireframe_data?: Json | null
        }
        Update: {
          ai_generated_video?: boolean | null
          briefing_approved_by_client?: boolean | null
          canvas_data?: string | null
          caption?: string | null
          company_id?: string
          copy?: string | null
          created_at?: string
          created_by?: string
          document_canvas_data?: Json | null
          file_url?: string | null
          id?: string
          internal_approval?: boolean | null
          internal_approved_at?: string | null
          internal_approved_by?: string | null
          is_briefing?: boolean | null
          is_running?: boolean | null
          metadata?: Json | null
          name?: string
          project_id?: string
          reference?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          thumbnail_url?: string | null
          type?: string
          updated_at?: string
          version_count?: number | null
          visualization_html?: string | null
          wireframe_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "materials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materials_internal_approved_by_fkey"
            columns: ["internal_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materials_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materials_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_ad_accounts: {
        Row: {
          account_id: string
          account_name: string
          company_id: string
          created_at: string
          currency: string | null
          id: string
          is_active: boolean | null
          last_synced_at: string | null
          status: string | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          account_name: string
          company_id: string
          created_at?: string
          currency?: string | null
          id?: string
          is_active?: boolean | null
          last_synced_at?: string | null
          status?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          account_name?: string
          company_id?: string
          created_at?: string
          currency?: string | null
          id?: string
          is_active?: boolean | null
          last_synced_at?: string | null
          status?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      meta_adsets: {
        Row: {
          account_id: string
          adset_id: string
          adset_name: string
          campaign_id: string
          company_id: string
          created_at: string
          id: string
          status: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          adset_id: string
          adset_name: string
          campaign_id: string
          company_id: string
          created_at?: string
          id?: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          adset_id?: string
          adset_name?: string
          campaign_id?: string
          company_id?: string
          created_at?: string
          id?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          comment_id: string | null
          created_at: string
          email_error: string | null
          email_provider_id: string | null
          email_sent_at: string | null
          id: string
          material_id: string | null
          mentioned_by: string | null
          message: string | null
          project_id: string | null
          read: boolean | null
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          comment_id?: string | null
          created_at?: string
          email_error?: string | null
          email_provider_id?: string | null
          email_sent_at?: string | null
          id?: string
          material_id?: string | null
          mentioned_by?: string | null
          message?: string | null
          project_id?: string | null
          read?: boolean | null
          title: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          comment_id?: string | null
          created_at?: string
          email_error?: string | null
          email_provider_id?: string | null
          email_sent_at?: string | null
          id?: string
          material_id?: string | null
          mentioned_by?: string | null
          message?: string | null
          project_id?: string | null
          read?: boolean | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          allowed_companies: Json | null
          avatar_url: string | null
          company_id: string | null
          created_at: string
          email: string
          first_login_required: boolean | null
          full_name: string
          id: string
          invitation_sent_at: string | null
          invitation_status: string | null
          meta_access_token: string | null
          meta_token_expires_at: string | null
          meta_user_id: string | null
          role: string
          temp_password_hash: string | null
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          allowed_companies?: Json | null
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          email: string
          first_login_required?: boolean | null
          full_name: string
          id?: string
          invitation_sent_at?: string | null
          invitation_status?: string | null
          meta_access_token?: string | null
          meta_token_expires_at?: string | null
          meta_user_id?: string | null
          role: string
          temp_password_hash?: string | null
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          allowed_companies?: Json | null
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          email?: string
          first_login_required?: boolean | null
          full_name?: string
          id?: string
          invitation_sent_at?: string | null
          invitation_status?: string | null
          meta_access_token?: string | null
          meta_token_expires_at?: string | null
          meta_user_id?: string | null
          role?: string
          temp_password_hash?: string | null
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      project_participants: {
        Row: {
          added_by: string
          created_at: string
          id: string
          project_id: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          added_by: string
          created_at?: string
          id?: string
          project_id: string
          role: string
          updated_at?: string
          user_id: string
        }
        Update: {
          added_by?: string
          created_at?: string
          id?: string
          project_id?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_participants_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          id: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          id?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      support_conversations: {
        Row: {
          created_at: string | null
          id: string
          last_auto_reply_sent_at: string | null
          last_message_at: string | null
          status: string
          support_user_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_auto_reply_sent_at?: string | null
          last_message_at?: string | null
          status?: string
          support_user_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          last_auto_reply_sent_at?: string | null
          last_message_at?: string | null
          status?: string
          support_user_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          is_read: boolean | null
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "support_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      taxonomy_patterns: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          id: string
          is_default: boolean | null
          pattern_name: string
          pattern_rules: Json
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by: string
          id?: string
          is_default?: boolean | null
          pattern_name: string
          pattern_rules: Json
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          id?: string
          is_default?: boolean | null
          pattern_name?: string
          pattern_rules?: Json
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_set_user_role: {
        Args: {
          new_role: Database["public"]["Enums"]["app_role"]
          target_user_id: string
        }
        Returns: undefined
      }
      check_email_authorization: {
        Args: { user_email: string }
        Returns: {
          is_authorized: boolean
          user_allowed_companies: Json
          user_company_id: string
          user_role: string
        }[]
      }
      ensure_updated_at_trigger: {
        Args: { _tbl: unknown; _trigger_name: string }
        Returns: undefined
      }
      get_company_id_for_operation: {
        Args: { _account_id?: string; _project_id?: string }
        Returns: string
      }
      get_conversation_user_profile: {
        Args: { _conversation_id: string }
        Returns: {
          avatar_url: string
          email: string
          full_name: string
        }[]
      }
      get_current_user_company_id: { Args: never; Returns: string }
      get_current_user_profile: {
        Args: never
        Returns: {
          allowed_companies: Json | null
          avatar_url: string | null
          company_id: string | null
          created_at: string
          email: string
          first_login_required: boolean | null
          full_name: string
          id: string
          invitation_sent_at: string | null
          invitation_status: string | null
          meta_access_token: string | null
          meta_token_expires_at: string | null
          meta_user_id: string | null
          role: string
          temp_password_hash: string | null
          updated_at: string
          user_id: string
          username: string | null
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_current_user_profile_debug: {
        Args: never
        Returns: {
          company_id: string
          email: string
          role: string
          user_id: string
        }[]
      }
      get_current_user_profile_id: { Args: never; Returns: string }
      get_current_user_role: { Args: never; Returns: string }
      get_project_participants_for_mentions: {
        Args: { _project_id: string }
        Returns: {
          avatar_url: string
          email: string
          full_name: string
          role: string
          user_id: string
          username: string
        }[]
      }
      get_support_user_id: { Args: never; Returns: string }
      get_user_allowed_companies: { Args: never; Returns: string[] }
      get_user_primary_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      sync_profile_with_authorized_email: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "client" | "collaborator"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "client", "collaborator"],
    },
  },
} as const
