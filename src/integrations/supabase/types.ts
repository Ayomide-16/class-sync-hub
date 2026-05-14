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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      aeirg_admin_config: {
        Row: {
          id: number
          it_period_end_date: string | null
          password_hash: string
        }
        Insert: {
          id?: number
          it_period_end_date?: string | null
          password_hash: string
        }
        Update: {
          id?: number
          it_period_end_date?: string | null
          password_hash?: string
        }
        Relationships: []
      }
      aeirg_attendance: {
        Row: {
          attendance_date: string
          created_at: string
          id: string
          manually_added: boolean
          matric_number: string
          source_packet_id: string | null
        }
        Insert: {
          attendance_date: string
          created_at?: string
          id?: string
          manually_added?: boolean
          matric_number: string
          source_packet_id?: string | null
        }
        Update: {
          attendance_date?: string
          created_at?: string
          id?: string
          manually_added?: boolean
          matric_number?: string
          source_packet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "aeirg_attendance_matric_number_fkey"
            columns: ["matric_number"]
            isOneToOne: false
            referencedRelation: "aeirg_students"
            referencedColumns: ["matric_number"]
          },
          {
            foreignKeyName: "aeirg_attendance_source_packet_id_fkey"
            columns: ["source_packet_id"]
            isOneToOne: false
            referencedRelation: "aeirg_raw_packets"
            referencedColumns: ["id"]
          },
        ]
      }
      aeirg_cancelled_days: {
        Row: {
          cancelled_date: string
          created_at: string
          id: string
          reason: string | null
        }
        Insert: {
          cancelled_date: string
          created_at?: string
          id?: string
          reason?: string | null
        }
        Update: {
          cancelled_date?: string
          created_at?: string
          id?: string
          reason?: string | null
        }
        Relationships: []
      }
      aeirg_raw_packets: {
        Row: {
          assigned_date: string
          id: string
          matric_numbers_json: Json
          packet_source: string | null
          received_at: string
        }
        Insert: {
          assigned_date: string
          id?: string
          matric_numbers_json: Json
          packet_source?: string | null
          received_at?: string
        }
        Update: {
          assigned_date?: string
          id?: string
          matric_numbers_json?: Json
          packet_source?: string | null
          received_at?: string
        }
        Relationships: []
      }
      aeirg_students: {
        Row: {
          added_at: string
          id: string
          matric_number: string
          must_change_password: boolean
          name: string
          password_hash: string
        }
        Insert: {
          added_at?: string
          id?: string
          matric_number: string
          must_change_password?: boolean
          name: string
          password_hash?: string
        }
        Update: {
          added_at?: string
          id?: string
          matric_number?: string
          must_change_password?: boolean
          name?: string
          password_hash?: string
        }
        Relationships: []
      }
      attendance_logs: {
        Row: {
          course_id: string | null
          created_at: string
          device_id: string | null
          id: string
          logged_at: string | null
          matric_number: string
          method: string
          raw_time: string | null
          schedule_id: string | null
          student_id: string | null
          student_name: string
          time_synced: boolean
          unmatched: boolean
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          device_id?: string | null
          id?: string
          logged_at?: string | null
          matric_number: string
          method: string
          raw_time?: string | null
          schedule_id?: string | null
          student_id?: string | null
          student_name: string
          time_synced?: boolean
          unmatched?: boolean
        }
        Update: {
          course_id?: string | null
          created_at?: string
          device_id?: string | null
          id?: string
          logged_at?: string | null
          matric_number?: string
          method?: string
          raw_time?: string | null
          schedule_id?: string | null
          student_id?: string | null
          student_name?: string
          time_synced?: boolean
          unmatched?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "attendance_logs_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_logs_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      course_enrollments: {
        Row: {
          course_id: string
          enrolled_at: string
          id: string
          student_id: string
        }
        Insert: {
          course_id: string
          enrolled_at?: string
          id?: string
          student_id: string
        }
        Update: {
          course_id?: string
          enrolled_at?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          course_code: string
          course_name: string
          course_rep_id: string | null
          created_at: string
          id: string
          lecturer_id: string | null
        }
        Insert: {
          course_code: string
          course_name: string
          course_rep_id?: string | null
          created_at?: string
          id?: string
          lecturer_id?: string | null
        }
        Update: {
          course_code?: string
          course_name?: string
          course_rep_id?: string | null
          created_at?: string
          id?: string
          lecturer_id?: string | null
        }
        Relationships: []
      }
      enrollment_records: {
        Row: {
          created_at: string
          enrolled_at: string | null
          fingerprint_id: number | null
          id: string
          matric_number: string
          raw_time: string | null
          rfid_card_id: string | null
          student_name: string
          time_synced: boolean
        }
        Insert: {
          created_at?: string
          enrolled_at?: string | null
          fingerprint_id?: number | null
          id?: string
          matric_number: string
          raw_time?: string | null
          rfid_card_id?: string | null
          student_name: string
          time_synced?: boolean
        }
        Update: {
          created_at?: string
          enrolled_at?: string | null
          fingerprint_id?: number | null
          id?: string
          matric_number?: string
          raw_time?: string | null
          rfid_card_id?: string | null
          student_name?: string
          time_synced?: boolean
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          fingerprint_id: number | null
          full_name: string
          id: string
          matric_number: string | null
          rfid_card_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          fingerprint_id?: number | null
          full_name?: string
          id: string
          matric_number?: string | null
          rfid_card_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          fingerprint_id?: number | null
          full_name?: string
          id?: string
          matric_number?: string | null
          rfid_card_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      schedules: {
        Row: {
          course_id: string
          created_at: string
          day_of_week: number
          device_id: string | null
          end_time: string
          id: string
          start_time: string
          venue: string | null
        }
        Insert: {
          course_id: string
          created_at?: string
          day_of_week: number
          device_id?: string | null
          end_time: string
          id?: string
          start_time: string
          venue?: string | null
        }
        Update: {
          course_id?: string
          created_at?: string
          day_of_week?: number
          device_id?: string | null
          end_time?: string
          id?: string
          start_time?: string
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      aeirg_student_change_password: {
        Args: { _current: string; _matric: string; _new: string }
        Returns: boolean
      }
      aeirg_student_force_set_password: {
        Args: { _matric: string; _new: string }
        Returns: boolean
      }
      aeirg_student_login: {
        Args: { _matric: string; _password: string }
        Returns: Json
      }
      aeirg_update_password: {
        Args: { _current: string; _new: string }
        Returns: boolean
      }
      aeirg_verify_password: { Args: { _password: string }; Returns: boolean }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_active_schedule_for_lecturer: {
        Args: { _lecturer_id: string }
        Returns: {
          course_code: string
          course_id: string
          course_name: string
          day_of_week: number
          device_id: string
          end_time: string
          schedule_id: string
          start_time: string
          venue: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "student" | "lecturer" | "course_rep"
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
      app_role: ["student", "lecturer", "course_rep"],
    },
  },
} as const
