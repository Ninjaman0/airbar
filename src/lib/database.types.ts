export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          username: string
          password: string
          role: 'normal' | 'admin'
          created_at: string
        }
        Insert: {
          id?: string
          username: string
          password: string
          role: 'normal' | 'admin'
          created_at?: string
        }
        Update: {
          id?: string
          username?: string
          password?: string
          role?: 'normal' | 'admin'
          created_at?: string
        }
      }
      categories: {
        Row: {
          id: string
          name: string
          section: 'store' | 'supplement'
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          section: 'store' | 'supplement'
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          section?: 'store' | 'supplement'
          created_at?: string
        }
      }
      items: {
        Row: {
          id: string
          name: string
          sell_price: string
          cost_price: string
          current_amount: number
          image: string | null
          category_id: string | null
          section: 'store' | 'supplement'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          sell_price: string
          cost_price: string
          current_amount?: number
          image?: string | null
          category_id?: string | null
          section: 'store' | 'supplement'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          sell_price?: string
          cost_price?: string
          current_amount?: number
          image?: string | null
          category_id?: string | null
          section?: 'store' | 'supplement'
          created_at?: string
          updated_at?: string
        }
      }
      customers: {
        Row: {
          id: string
          name: string
          section: 'store' | 'supplement'
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          section: 'store' | 'supplement'
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          section?: 'store' | 'supplement'
          created_at?: string
        }
      }
      shifts: {
        Row: {
          id: string
          user_id: string
          username: string
          section: 'store' | 'supplement'
          status: 'active' | 'closed'
          purchases: Json
          expenses: Json
          total_amount: string
          start_time: string
          end_time: string | null
          final_inventory: Json | null
          final_cash: string | null
          discrepancies: Json | null
          close_reason: string | null
          validation_status: 'balanced' | 'discrepancy'
        }
        Insert: {
          id?: string
          user_id: string
          username: string
          section: 'store' | 'supplement'
          status: 'active' | 'closed'
          purchases?: Json
          expenses?: Json
          total_amount?: string
          start_time?: string
          end_time?: string | null
          final_inventory?: Json | null
          final_cash?: string | null
          discrepancies?: Json | null
          close_reason?: string | null
          validation_status?: 'balanced' | 'discrepancy'
        }
        Update: {
          id?: string
          user_id?: string
          username?: string
          section?: 'store' | 'supplement'
          status?: 'active' | 'closed'
          purchases?: Json
          expenses?: Json
          total_amount?: string
          start_time?: string
          end_time?: string | null
          final_inventory?: Json | null
          final_cash?: string | null
          discrepancies?: Json | null
          close_reason?: string | null
          validation_status?: 'balanced' | 'discrepancy'
        }
      }
      customer_purchases: {
        Row: {
          id: string
          customer_id: string
          customer_name: string
          items: Json
          total_amount: string
          section: 'store' | 'supplement'
          shift_id: string | null
          is_paid: boolean
          timestamp: string
        }
        Insert: {
          id?: string
          customer_id: string
          customer_name: string
          items: Json
          total_amount: string
          section: 'store' | 'supplement'
          shift_id?: string | null
          is_paid?: boolean
          timestamp?: string
        }
        Update: {
          id?: string
          customer_id?: string
          customer_name?: string
          items?: Json
          total_amount?: string
          section?: 'store' | 'supplement'
          shift_id?: string | null
          is_paid?: boolean
          timestamp?: string
        }
      }
      expenses: {
        Row: {
          id: string
          amount: string
          reason: string
          shift_id: string
          section: 'store' | 'supplement'
          timestamp: string
          created_by: string
        }
        Insert: {
          id?: string
          amount: string
          reason: string
          shift_id: string
          section: 'store' | 'supplement'
          timestamp?: string
          created_by: string
        }
        Update: {
          id?: string
          amount?: string
          reason?: string
          shift_id?: string
          section?: 'store' | 'supplement'
          timestamp?: string
          created_by?: string
        }
      }
      supplies: {
        Row: {
          id: string
          section: 'store' | 'supplement'
          items: Json
          total_cost: string
          timestamp: string
          created_by: string
        }
        Insert: {
          id?: string
          section: 'store' | 'supplement'
          items: Json
          total_cost: string
          timestamp?: string
          created_by: string
        }
        Update: {
          id?: string
          section?: 'store' | 'supplement'
          items?: Json
          total_cost?: string
          timestamp?: string
          created_by?: string
        }
      }
      admin_logs: {
        Row: {
          id: string
          action_type: string
          item_or_shift_affected: string
          change_details: string
          timestamp: string
          admin_name: string
          section: 'store' | 'supplement' | null
        }
        Insert: {
          id?: string
          action_type: string
          item_or_shift_affected: string
          change_details: string
          timestamp?: string
          admin_name: string
          section?: 'store' | 'supplement' | null
        }
        Update: {
          id?: string
          action_type?: string
          item_or_shift_affected?: string
          change_details?: string
          timestamp?: string
          admin_name?: string
          section?: 'store' | 'supplement' | null
        }
      }
      shift_edits: {
        Row: {
          id: string
          shift_id: string
          field: string
          old_value: Json | null
          new_value: Json | null
          reason: string
          timestamp: string
          edited_by: string
        }
        Insert: {
          id?: string
          shift_id: string
          field: string
          old_value?: Json | null
          new_value?: Json | null
          reason: string
          timestamp?: string
          edited_by: string
        }
        Update: {
          id?: string
          shift_id?: string
          field?: string
          old_value?: Json | null
          new_value?: Json | null
          reason?: string
          timestamp?: string
          edited_by?: string
        }
      }
      supplement_debt: {
        Row: {
          id: string
          amount: string
          last_updated: string
          updated_by: string
        }
        Insert: {
          id?: string
          amount: string
          last_updated?: string
          updated_by: string
        }
        Update: {
          id?: string
          amount?: string
          last_updated?: string
          updated_by?: string
        }
      }
      settings: {
        Row: {
          key: string
          value: Json
        }
        Insert: {
          key: string
          value: Json
        }
        Update: {
          key?: string
          value?: Json
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}